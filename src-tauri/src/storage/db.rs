use crate::storage::migrations::get_migrations;
use parking_lot::Mutex;
use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;
use std::sync::Arc;

/// A shared database connection (read‑write, used by background sampler).
#[derive(Clone)]
pub struct DbState(pub Arc<Mutex<Connection>>);

/// Read‑only connection for command handlers.
/// Uses a regular connection with `query_only = ON` to ensure full WAL visibility.
#[derive(Clone)]
pub struct ReadOnlyDb(pub Arc<Mutex<Connection>>);

impl DbState {
    /// Opens the database; if it is corrupt or cannot be migrated, moves the
    /// files aside (`fluxnet.db.broken-<unix ts>`) and starts a fresh one so
    /// the app still launches. Settings live in JSON and are unaffected.
    pub fn open_or_recover(app_data_dir: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        match Self::open(app_data_dir) {
            Ok(db) => Ok(db),
            Err(e) => {
                tracing::error!("Database unusable ({e}); moving it aside and starting fresh");
                let stamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or_default();
                for suffix in ["", "-wal", "-shm"] {
                    let from = app_data_dir.join(format!("fluxnet.db{suffix}"));
                    if from.exists() {
                        let to = app_data_dir.join(format!("fluxnet.db{suffix}.broken-{stamp}"));
                        if let Err(e) = std::fs::rename(&from, &to) {
                            tracing::error!("Could not move {} aside: {e}", from.display());
                        }
                    }
                }
                Self::open(app_data_dir)
            }
        }
    }

    /// Open a read‑write connection, create DB if missing, run migrations.
    pub fn open(app_data_dir: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("fluxnet.db");

        let mut conn = Connection::open(&db_path)?;

        // Fail fast on a corrupt file so `open_or_recover` can replace it.
        let check: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
        if check != "ok" {
            return Err(format!("integrity check failed: {check}").into());
        }

        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous   = NORMAL;
             PRAGMA foreign_keys  = ON;
             PRAGMA cache_size    = -8000;",
        )?;

        let migrations = get_migrations();
        migrations.to_latest(&mut conn)?;

        Ok(Self(Arc::new(Mutex::new(conn))))
    }
}

impl ReadOnlyDb {
    /// Open a connection that can fully read WAL data but cannot write.
    /// Using `query_only = ON` instead of `SQLITE_OPEN_READ_ONLY` to ensure
    /// this connection properly participates in WAL shared-memory and can see
    /// the latest committed data from the write connection.
    pub fn open(app_data_dir: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("fluxnet.db");

        let conn = Connection::open_with_flags(
            &db_path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;

        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA query_only   = ON;
             PRAGMA cache_size   = -4000;",
        )?;

        Ok(Self(Arc::new(Mutex::new(conn))))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("fluxnet-db-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn corrupt_database_is_moved_aside_and_recreated() {
        let dir = temp_dir("corrupt");
        std::fs::write(dir.join("fluxnet.db"), vec![0xAB; 8192]).unwrap();

        let db = DbState::open_or_recover(&dir).expect("recovers");
        let n: i64 =
            db.0.lock()
                .query_row("SELECT COUNT(*) FROM bandwidth_samples", [], |r| r.get(0))
                .unwrap();
        assert_eq!(n, 0);

        let moved_aside = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .any(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("fluxnet.db.broken-")
            });
        assert!(moved_aside);
    }

    #[test]
    fn healthy_database_is_reused() {
        let dir = temp_dir("healthy");
        {
            let db = DbState::open_or_recover(&dir).unwrap();
            crate::storage::repository::insert_sample(&db.0.lock(), 1, "eth0", 1.0, 1.0, 500)
                .unwrap();
        }
        let db = DbState::open_or_recover(&dir).unwrap();
        let n: i64 =
            db.0.lock()
                .query_row("SELECT COUNT(*) FROM bandwidth_samples", [], |r| r.get(0))
                .unwrap();
        assert_eq!(n, 1);
    }
}

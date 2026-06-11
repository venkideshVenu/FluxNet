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
    /// Open a read‑write connection, create DB if missing, run migrations.
    pub fn open(app_data_dir: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("fluxnet.db");

        let mut conn = Connection::open(&db_path)?;

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

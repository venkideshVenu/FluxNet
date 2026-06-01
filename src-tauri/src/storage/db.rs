use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::storage::migrations::get_migrations;

/// Tauri-managed state wrapping a single SQLite connection.
///
/// Command handlers lock this for reads (get_usage_stats, etc.).
/// The background sampler task opens its own separate connection via
/// `DbState::open()` so writes never block command handlers. Migrations are
/// idempotent, so a second open is safe even though it repeats the check.
/// Both connections use WAL mode and can run concurrently safely.
pub struct DbState(pub Mutex<Connection>);

impl DbState {
    /// Open (or create) the database at `{app_data_dir}/fluxnet.db`
    /// and run all pending schema migrations.
    pub fn open(app_data_dir: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("fluxnet.db");

        let mut conn = Connection::open(&db_path)?;

        // WAL mode: concurrent readers + one writer, no blocking between them.
        // NORMAL synchronous: safe on power loss after a commit, much faster than FULL.
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous   = NORMAL;
             PRAGMA foreign_keys  = ON;
             PRAGMA cache_size    = -8000;", // 8 MB page cache
        )?;

        // Apply any missing migrations in order.
        let migrations = get_migrations();
        migrations.to_latest(&mut conn)?;

        Ok(Self(Mutex::new(conn)))
    }
}

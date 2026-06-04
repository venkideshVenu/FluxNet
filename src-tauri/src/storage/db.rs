use crate::storage::migrations::get_migrations;
use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::PathBuf;

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

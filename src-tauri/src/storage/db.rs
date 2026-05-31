use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::storage::migrations::get_migrations;

pub struct DbState(pub Mutex<Connection>);

impl DbState {
    /// Open (or create) the database and run all pending migrations.
    pub fn open(app_data_dir: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("fluxnet.db");

        let mut conn = Connection::open(&db_path)?;

        // Performance pragmas — safe for a single-writer desktop app
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous   = NORMAL;
             PRAGMA foreign_keys  = ON;",
        )?;

        // Run migrations
        let migrations = get_migrations();
        migrations.to_latest(&mut conn)?;

        Ok(Self(Mutex::new(conn)))
    }
}

use rusqlite_migration::{Migrations, M};

pub fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        // v1 — initial schema
        M::up(
            "CREATE TABLE schema_version (
                version INTEGER PRIMARY KEY
            );

            CREATE TABLE bandwidth_samples (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp       INTEGER NOT NULL,
                interface_name  TEXT    NOT NULL,
                download_bps    REAL    NOT NULL,
                upload_bps      REAL    NOT NULL
            );
            CREATE INDEX idx_samples_ts ON bandwidth_samples(timestamp);

            CREATE TABLE hourly_usage (
                hour_start            INTEGER PRIMARY KEY,
                avg_download_bps      REAL    NOT NULL,
                avg_upload_bps        REAL    NOT NULL,
                peak_download_bps     REAL    NOT NULL,
                peak_upload_bps       REAL    NOT NULL,
                total_download_bytes  INTEGER NOT NULL,
                total_upload_bytes    INTEGER NOT NULL,
                sample_count          INTEGER NOT NULL
            );

            CREATE TABLE daily_usage (
                day                   TEXT    PRIMARY KEY,
                avg_download_bps      REAL    NOT NULL,
                avg_upload_bps        REAL    NOT NULL,
                peak_download_bps     REAL    NOT NULL,
                peak_upload_bps       REAL    NOT NULL,
                total_download_bytes  INTEGER NOT NULL,
                total_upload_bytes    INTEGER NOT NULL
            );

            CREATE TABLE monthly_usage (
                month                 TEXT    PRIMARY KEY,
                total_download_bytes  INTEGER NOT NULL,
                total_upload_bytes    INTEGER NOT NULL,
                peak_download_bps     REAL    NOT NULL,
                peak_upload_bps       REAL    NOT NULL
            );",
        ),
        // v2 — future: add latency tracking
        // M::up("ALTER TABLE bandwidth_samples ADD COLUMN latency_ms REAL;"),
    ])
}

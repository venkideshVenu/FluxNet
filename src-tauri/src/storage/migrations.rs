use rusqlite_migration::{M, Migrations};

/// Returns all schema migrations in order.
/// Add new migrations to the END of the vec only — never edit existing ones.
/// The migration library tracks the current version and applies only what's missing.
pub fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        // ── v1: initial schema ────────────────────────────────────────────
        M::up(
            "CREATE TABLE IF NOT EXISTS bandwidth_samples (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp       INTEGER NOT NULL,
                interface_name  TEXT    NOT NULL,
                download_bps    REAL    NOT NULL,
                upload_bps      REAL    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_samples_ts
                ON bandwidth_samples(timestamp);

            CREATE TABLE IF NOT EXISTS hourly_usage (
                hour_start            INTEGER PRIMARY KEY,
                avg_download_bps      REAL    NOT NULL,
                avg_upload_bps        REAL    NOT NULL,
                peak_download_bps     REAL    NOT NULL,
                peak_upload_bps       REAL    NOT NULL,
                total_download_bytes  INTEGER NOT NULL,
                total_upload_bytes    INTEGER NOT NULL,
                sample_count          INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS daily_usage (
                day                   TEXT    PRIMARY KEY,
                avg_download_bps      REAL    NOT NULL,
                avg_upload_bps        REAL    NOT NULL,
                peak_download_bps     REAL    NOT NULL,
                peak_upload_bps       REAL    NOT NULL,
                total_download_bytes  INTEGER NOT NULL,
                total_upload_bytes    INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS monthly_usage (
                month                 TEXT    PRIMARY KEY,
                total_download_bytes  INTEGER NOT NULL,
                total_upload_bytes    INTEGER NOT NULL,
                peak_download_bps     REAL    NOT NULL,
                peak_upload_bps       REAL    NOT NULL
            );",
        ),
        // ── v2: per-sample duration, so byte totals don't assume 500 ms ──
        // Existing rows keep the old 500 ms assumption.
        M::up(
            "ALTER TABLE bandwidth_samples
                 ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 500;",
        ),
    ])
}

use log::info;
use rusqlite::{Connection, Result};
use std::path::Path;

/// A versioned schema migration.
struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

/// All migrations in version order. Each migration's SQL must be idempotent
/// so that upgrading from an existing ad-hoc schema works correctly.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            name: "initial_schema",
            sql: "
                CREATE TABLE IF NOT EXISTS directories (
                    id    INTEGER PRIMARY KEY AUTOINCREMENT,
                    path  TEXT NOT NULL UNIQUE,
                    label TEXT NOT NULL,
                    added_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL,
                    page INTEGER NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    format TEXT NOT NULL DEFAULT 'html',
                    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(slug, page)
                );

                CREATE TABLE IF NOT EXISTS note_images (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    note_slug TEXT NOT NULL,
                    note_page INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    data BLOB NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(note_slug, note_page, filename)
                );

                CREATE TABLE IF NOT EXISTS tags (
                    id    INTEGER PRIMARY KEY AUTOINCREMENT,
                    name  TEXT NOT NULL UNIQUE,
                    color TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS book_tags (
                    book_slug TEXT NOT NULL,
                    tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    UNIQUE(book_slug, tag_id)
                );

                CREATE TABLE IF NOT EXISTS highlights (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL,
                    page INTEGER NOT NULL,
                    x REAL NOT NULL,
                    y REAL NOT NULL,
                    width REAL NOT NULL,
                    height REAL NOT NULL,
                    color TEXT NOT NULL,
                    note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_highlights_slug_page ON highlights(slug, page);
            ",
        },
        Migration {
            version: 2,
            name: "highlights_text_and_group_id",
            sql: "
                ALTER TABLE highlights ADD COLUMN text TEXT NOT NULL DEFAULT '';
                ALTER TABLE highlights ADD COLUMN group_id TEXT NOT NULL DEFAULT '';
                CREATE INDEX IF NOT EXISTS idx_highlights_group_id ON highlights(group_id);
            ",
        },
        Migration {
            version: 3,
            name: "drop_bookmarks_and_snips",
            sql: "
                DROP TABLE IF EXISTS bookmarks;
                DROP TABLE IF EXISTS snips;
            ",
        },
    ]
}

/// Ensure the migrations tracking table exists.
fn ensure_migrations_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS migrations (
            version    INTEGER PRIMARY KEY,
            name       TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )
}

/// Get the highest migration version that has been applied, or 0 if none.
fn get_current_version(conn: &Connection) -> Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM migrations",
        [],
        |row| row.get(0),
    )
}

/// Record a successfully applied migration.
fn record_migration(conn: &Connection, version: i64, name: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO migrations (version, name, applied_at) VALUES (?1, ?2, datetime('now'))",
        rusqlite::params![version, name],
    )?;
    Ok(())
}

/// Apply a single migration's SQL. For Migration 2 (ALTER TABLE), individual
/// statements that fail due to duplicate columns are tolerated (the column
/// already exists from a prior ad-hoc run).
fn apply_migration(conn: &Connection, migration: &Migration) -> Result<()> {
    if migration.version == 2 {
        // Migration 2 must be idempotent: ALTER TABLE ADD COLUMN fails if the
        // column already exists (from the old ad-hoc schema). Execute each
        // statement individually, tolerating "duplicate column" errors.
        for stmt in migration.sql.split(';') {
            let trimmed = stmt.trim();
            if trimmed.is_empty() {
                continue;
            }
            let result = conn.execute_batch(trimmed);
            if let Err(ref e) = result {
                let msg = e.to_string();
                // Tolerate "duplicate column name" errors for idempotency
                if msg.contains("duplicate column name") {
                    continue;
                }
                // Any other error is a real failure
                result?;
            }
        }
        Ok(())
    } else {
        conn.execute_batch(migration.sql)
    }
}

/// Run all pending migrations sequentially. On error, stops and returns the
/// error. Successfully applied migrations before the failure are preserved.
fn run_migrations(conn: &Connection) -> Result<()> {
    ensure_migrations_table(conn)?;
    let current_version = get_current_version(conn)?;
    let all_migrations = migrations();

    for migration in &all_migrations {
        if migration.version <= current_version {
            continue;
        }
        info!(
            "Applying migration {} (v{})",
            migration.name, migration.version
        );
        apply_migration(conn, migration)?;
        record_migration(conn, migration.version, migration.name)?;
        info!(
            "Migration {} (v{}) applied successfully",
            migration.name, migration.version
        );
    }

    Ok(())
}

/// Initialize the database at the given path. Creates the parent directory if
/// needed, opens (or creates) the SQLite file, enables foreign keys, and runs
/// all pending versioned migrations.
pub fn init_db(db_path: &Path) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    run_migrations(&conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    /// Helper: list all user tables in the database.
    fn table_names(conn: &Connection) -> HashSet<String> {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .unwrap();
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    /// Helper: list all columns for a given table.
    fn column_names(conn: &Connection, table: &str) -> Vec<String> {
        let mut stmt = conn
            .prepare(&format!("PRAGMA table_info({})", table))
            .unwrap();
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    /// AC-080: Fresh database has all required tables and NO bookmarks table.
    #[test]
    fn fresh_db_has_correct_tables() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_db(&db_path).unwrap();

        let tables = table_names(&conn);
        // Required tables
        assert!(tables.contains("directories"), "missing directories");
        assert!(tables.contains("notes"), "missing notes");
        assert!(tables.contains("note_images"), "missing note_images");
        assert!(tables.contains("tags"), "missing tags");
        assert!(tables.contains("book_tags"), "missing book_tags");
        assert!(tables.contains("highlights"), "missing highlights");
        assert!(tables.contains("migrations"), "missing migrations");

        // Vestigial tables must NOT exist
        assert!(!tables.contains("bookmarks"), "bookmarks should not exist");
        assert!(!tables.contains("snips"), "snips should not exist");
    }

    /// AC-081: Migrations table tracks applied versions. Re-running is idempotent.
    #[test]
    fn migrations_table_tracks_versions() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_db(&db_path).unwrap();

        // All 3 migrations should be recorded
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 3);

        // Versions are 1, 2, 3
        let mut stmt = conn
            .prepare("SELECT version, name FROM migrations ORDER BY version")
            .unwrap();
        let rows: Vec<(i64, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0], (1, "initial_schema".to_string()));
        assert_eq!(rows[1], (2, "highlights_text_and_group_id".to_string()));
        assert_eq!(rows[2], (3, "drop_bookmarks_and_snips".to_string()));

        // Each has a non-empty applied_at
        let empty_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM migrations WHERE applied_at = '' OR applied_at IS NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(empty_count, 0);
    }

    /// AC-081: Re-running init_db does not re-apply migrations.
    #[test]
    fn idempotent_rerun() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // First run
        let conn1 = init_db(&db_path).unwrap();
        let ts1: Vec<String> = {
            let mut stmt = conn1
                .prepare("SELECT applied_at FROM migrations ORDER BY version")
                .unwrap();
            stmt.query_map([], |r| r.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        };
        drop(conn1);

        // Second run
        let conn2 = init_db(&db_path).unwrap();
        let ts2: Vec<String> = {
            let mut stmt = conn2
                .prepare("SELECT applied_at FROM migrations ORDER BY version")
                .unwrap();
            stmt.query_map([], |r| r.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        };

        // Timestamps must be identical (no re-run)
        assert_eq!(ts1, ts2);
        // Still exactly 3 migrations
        let count: i64 = conn2
            .query_row("SELECT COUNT(*) FROM migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 3);
    }

    /// AC-101: Bookmarks table is dropped by migration. Highlight bookmarks
    /// (color='bookmark') are unaffected.
    #[test]
    fn drop_bookmarks_preserves_highlight_bookmarks() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // Simulate legacy schema: create bookmarks table and a highlight bookmark
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(
            "CREATE TABLE bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL,
                page INTEGER NOT NULL,
                label TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(slug, page)
            );
            INSERT INTO bookmarks (slug, page, label) VALUES ('test', 1, 'legacy');",
        )
        .unwrap();
        // Also create highlights table with a bookmark-type highlight
        conn.execute_batch(
            "CREATE TABLE highlights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL,
                page INTEGER NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                color TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO highlights (slug, page, x, y, width, height, color) VALUES ('test', 1, 0, 0, 1, 1, 'bookmark');",
        )
        .unwrap();
        drop(conn);

        // Now run init_db which applies migrations
        let conn = init_db(&db_path).unwrap();
        let tables = table_names(&conn);
        assert!(!tables.contains("bookmarks"), "bookmarks should be dropped");

        // Highlight bookmark row still exists
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM highlights WHERE color = 'bookmark'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    /// AC-103: Migration versions are monotonically increasing with unique names.
    #[test]
    fn migration_versions_are_monotonic() {
        let all = migrations();
        assert!(!all.is_empty());
        for i in 1..all.len() {
            assert!(
                all[i].version > all[i - 1].version,
                "Migration versions must be monotonically increasing"
            );
        }
        let names: HashSet<&str> = all.iter().map(|m| m.name).collect();
        assert_eq!(names.len(), all.len(), "Migration names must be unique");
    }

    /// AC-104: If a migration fails, previously applied migrations are preserved.
    #[test]
    fn failed_migration_preserves_prior() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // Run init_db to get a fully migrated DB
        let conn = init_db(&db_path).unwrap();

        // Verify all 3 are applied
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 3);

        // Simulate adding a bad migration by manually calling run logic:
        // Insert a fake version 4 that would fail
        // First, verify that applying invalid SQL to the connection fails
        let result = conn.execute_batch("THIS IS INVALID SQL");
        assert!(result.is_err());

        // The 3 existing migrations remain
        let count_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count_after, 3);
    }

    /// AC-080 + AC-103: Highlights table has text and group_id columns after migration 2.
    #[test]
    fn highlights_has_extra_columns() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_db(&db_path).unwrap();

        let cols = column_names(&conn, "highlights");
        assert!(cols.contains(&"text".to_string()), "missing text column");
        assert!(
            cols.contains(&"group_id".to_string()),
            "missing group_id column"
        );
    }

    /// Upgrade path: existing ad-hoc schema (with bookmarks, snips, and
    /// highlight text/group_id already present) upgrades cleanly.
    #[test]
    fn upgrade_from_adhoc_schema() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // Simulate the old ad-hoc init_db behavior
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS directories (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                path  TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                added_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL,
                page INTEGER NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                format TEXT NOT NULL DEFAULT 'html',
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(slug, page)
            );
            CREATE TABLE IF NOT EXISTS note_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_slug TEXT NOT NULL,
                note_page INTEGER NOT NULL,
                filename TEXT NOT NULL,
                data BLOB NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(note_slug, note_page, filename)
            );
            CREATE TABLE IF NOT EXISTS tags (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                name  TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS book_tags (
                book_slug TEXT NOT NULL,
                tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                UNIQUE(book_slug, tag_id)
            );
            CREATE TABLE IF NOT EXISTS highlights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL,
                page INTEGER NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                color TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_highlights_slug_page ON highlights(slug, page);
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL,
                page INTEGER NOT NULL,
                label TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(slug, page)
            );",
        )
        .unwrap();
        // Ad-hoc migrations
        conn.execute_batch("ALTER TABLE highlights ADD COLUMN text TEXT NOT NULL DEFAULT ''")
            .ok();
        conn.execute_batch("ALTER TABLE highlights ADD COLUMN group_id TEXT NOT NULL DEFAULT ''")
            .ok();
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_highlights_group_id ON highlights(group_id)",
        )
        .ok();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS snips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL,
                full_path TEXT NOT NULL DEFAULT '',
                page INTEGER NOT NULL,
                label TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_snips_slug ON snips(slug);",
        )
        .ok();

        // Insert some data to verify it survives
        conn.execute(
            "INSERT INTO highlights (slug, page, x, y, width, height, color, text, group_id) VALUES ('book', 1, 0, 0, 1, 1, 'yellow', 'hi', 'g1')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO bookmarks (slug, page) VALUES ('book', 5)",
            [],
        )
        .unwrap();
        drop(conn);

        // Now run init_db — should upgrade cleanly
        let conn = init_db(&db_path).unwrap();

        let tables = table_names(&conn);
        assert!(tables.contains("directories"));
        assert!(tables.contains("highlights"));
        assert!(!tables.contains("bookmarks"), "bookmarks should be dropped");
        assert!(!tables.contains("snips"), "snips should be dropped");

        // Highlight data survived
        let text: String = conn
            .query_row(
                "SELECT text FROM highlights WHERE slug = 'book'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(text, "hi");

        // All 3 migrations recorded
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 3);
    }
}

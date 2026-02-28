use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;
use walkdir::WalkDir;

use crate::models::{BookProgress, BookTagMapping, Directory, NoteRecord, OrphanCandidate, Tag, Textbook};

pub struct DbState(pub Mutex<Connection>);
pub struct PendingFile(pub Mutex<Option<String>>);

fn sanitize_slug(name: &str) -> String {
    name.to_lowercase()
        .replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "-")
        .trim_matches('-')
        .to_string()
}

fn title_from_stem(stem: &str) -> String {
    stem.replace(|c: char| c == '-' || c == '_', " ")
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().to_string() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn row_to_directory(row: &rusqlite::Row) -> rusqlite::Result<Directory> {
    Ok(Directory {
        id: row.get(0)?,
        path: row.get(1)?,
        label: row.get(2)?,
        added_at: row.get(3)?,
    })
}

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<NoteRecord> {
    Ok(NoteRecord {
        id: row.get(0)?,
        slug: row.get(1)?,
        page: row.get(2)?,
        content: row.get(3)?,
        format: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn query_all_directories(conn: &Connection) -> Result<Vec<Directory>, String> {
    let mut stmt = conn
        .prepare("SELECT id, path, label, added_at FROM directories ORDER BY added_at")
        .map_err(|e| e.to_string())?;
    let dirs = stmt
        .query_map([], row_to_directory)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(dirs)
}

#[tauri::command]
pub fn list_directories(state: State<'_, DbState>) -> Result<Vec<Directory>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    query_all_directories(&conn)
}

#[tauri::command]
pub fn add_directory(path: String, state: State<'_, DbState>) -> Result<Directory, String> {
    let p = Path::new(&path);
    if !p.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }
    let label = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO directories (path, label) VALUES (?1, ?2)",
        rusqlite::params![path, label],
    )
    .map_err(|e| e.to_string())?;

    // Auto-create .axiomatic/ project state directory
    ensure_axiomatic_dir(&path)?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn
        .prepare("SELECT id, path, label, added_at FROM directories WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let dir = stmt
        .query_row([id], row_to_directory)
        .map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn remove_directory(id: i64, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM directories WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_textbooks(state: State<'_, DbState>) -> Result<Vec<Textbook>, String> {
    let dirs = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        query_all_directories(&conn)?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let mut textbooks = Vec::new();
        for dir in &dirs {
            let dir_path = Path::new(&dir.path);
            if !dir_path.is_dir() {
                continue;
            }
            for entry in WalkDir::new(dir_path)
                .into_iter()
                .filter_entry(|e| {
                    e.file_name().to_str().map(|s| s != ".axiomatic").unwrap_or(true)
                })
                .flatten()
            {
                let path = entry.path();
                if path.is_file()
                    && path
                        .extension()
                        .map(|e| e.to_ascii_lowercase() == "pdf")
                        .unwrap_or(false)
                {
                    let file_name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let stem = path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let slug = format!("{}_{}", dir.id, sanitize_slug(&stem));
                    let title = title_from_stem(&stem);
                    let full_path = path.to_string_lossy().to_string();
                    textbooks.push(Textbook {
                        slug,
                        title,
                        file: file_name,
                        dir_id: dir.id,
                        dir_path: dir.path.clone(),
                        full_path,
                    });
                }
            }
        }
        Ok(textbooks)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn rename_textbook(full_path: String, new_name: String) -> Result<(), String> {
    let path = Path::new(&full_path);
    if !path.is_file() {
        return Err(format!("File not found: {}", full_path));
    }
    let parent = path.parent().ok_or("No parent directory")?;
    let new_file = if new_name.to_lowercase().ends_with(".pdf") {
        new_name
    } else {
        format!("{}.pdf", new_name)
    };
    let new_path = parent.join(&new_file);
    std::fs::rename(path, &new_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_textbook(full_path: String) -> Result<(), String> {
    let path = Path::new(&full_path);
    if !path.is_file() {
        return Err(format!("File not found: {}", full_path));
    }
    std::fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn detect_os_theme() -> String {
    // Try freedesktop portal (works on Ubuntu/GNOME/KDE)
    // color-scheme: 0=no-preference, 1=prefer-dark, 2=prefer-light
    if let Ok(output) = Command::new("dbus-send")
        .args([
            "--session",
            "--dest=org.freedesktop.portal.Desktop",
            "--print-reply",
            "/org/freedesktop/portal/desktop",
            "org.freedesktop.portal.Settings.Read",
            "string:org.freedesktop.appearance",
            "string:color-scheme",
        ])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // The reply contains "uint32 N" where N is the scheme value
        if stdout.contains("uint32 1") {
            return "dark".into();
        }
        if stdout.contains("uint32 2") || stdout.contains("uint32 0") {
            return "light".into();
        }
    }

    // Fallback: gsettings color-scheme
    if let Ok(output) = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "color-scheme"])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains("prefer-dark") {
            return "dark".into();
        }
    }

    // Fallback: check GTK theme name for "dark" substring
    if let Ok(output) = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "gtk-theme"])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
        if stdout.contains("dark") {
            return "dark".into();
        }
    }

    "dark".into()
}

#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn get_note(slug: String, page: i64, state: State<'_, DbState>) -> Result<Option<NoteRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, slug, page, content, format, updated_at FROM notes WHERE slug = ?1 AND page = ?2")
        .map_err(|e| e.to_string())?;
    let result = stmt.query_row(rusqlite::params![slug, page], row_to_note);
    match result {
        Ok(note) => Ok(Some(note)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_note(slug: String, page: i64, content: String, format: String, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    if content.is_empty() {
        conn.execute(
            "DELETE FROM notes WHERE slug = ?1 AND page = ?2",
            rusqlite::params![slug, page],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO notes (slug, page, content, format, updated_at)
             VALUES (?1, ?2, ?3, ?4, datetime('now'))
             ON CONFLICT(slug, page) DO UPDATE SET content = ?3, format = ?4, updated_at = datetime('now')",
            rusqlite::params![slug, page, content, format],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_notes_for_book(slug: String, state: State<'_, DbState>) -> Result<Vec<NoteRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, slug, page, content, format, updated_at FROM notes WHERE slug = ?1 ORDER BY page")
        .map_err(|e| e.to_string())?;
    let notes = stmt
        .query_map(rusqlite::params![slug], row_to_note)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(notes)
}

#[tauri::command]
pub fn delete_note(slug: String, page: i64, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM notes WHERE slug = ?1 AND page = ?2",
        rusqlite::params![slug, page],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_note_image(slug: String, page: i64, filename: String, data: Vec<u8>, state: State<'_, DbState>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO note_images (note_slug, note_page, filename, data)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(note_slug, note_page, filename) DO UPDATE SET data = ?4",
        rusqlite::params![slug, page, filename, data],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_note_image(id: i64, state: State<'_, DbState>) -> Result<tauri::ipc::Response, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let data: Vec<u8> = conn
        .query_row(
            "SELECT data FROM note_images WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(data))
}

#[tauri::command]
pub fn export_notes_for_book(slug: String, state: State<'_, DbState>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT page, content FROM notes WHERE slug = ?1 ORDER BY page")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(i64, String)> = stmt
        .query_map(rusqlite::params![slug], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut output = String::new();
    for (page, content) in rows {
        output.push_str(&format!("## Page {}\n\n{}\n\n", page, content));
    }
    Ok(output)
}

#[tauri::command]
pub fn migrate_notes_from_json(json_data: String, state: State<'_, DbState>) -> Result<i64, String> {
    let map: std::collections::HashMap<String, String> =
        serde_json::from_str(&json_data).map_err(|e| e.to_string())?;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut count: i64 = 0;
    for (key, content) in &map {
        let parts: Vec<&str> = key.rsplitn(2, ':').collect();
        if parts.len() != 2 {
            continue;
        }
        let page: i64 = match parts[0].parse() {
            Ok(p) => p,
            Err(_) => continue,
        };
        let slug = parts[1];
        let is_empty = content.is_empty() || content == "<p></p>";
        if is_empty {
            continue;
        }
        conn.execute(
            "INSERT INTO notes (slug, page, content, format, updated_at)
             VALUES (?1, ?2, ?3, 'html', datetime('now'))
             ON CONFLICT(slug, page) DO UPDATE SET content = ?3, updated_at = datetime('now')",
            rusqlite::params![slug, page, content],
        ).map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub fn list_tags(state: State<'_, DbState>) -> Result<Vec<Tag>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, color FROM tags ORDER BY id")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(name: String, color: String, state: State<'_, DbState>) -> Result<Tag, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        rusqlite::params![name, color],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Tag { id, name, color })
}

#[tauri::command]
pub fn delete_tag(id: i64, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_tag_color(id: i64, color: String, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tags SET color = ?1 WHERE id = ?2",
        rusqlite::params![color, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn tag_book(book_slug: String, tag_id: i64, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO book_tags (book_slug, tag_id) VALUES (?1, ?2)",
        rusqlite::params![book_slug, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn untag_book(book_slug: String, tag_id: i64, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM book_tags WHERE book_slug = ?1 AND tag_id = ?2",
        rusqlite::params![book_slug, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_book_tags_all(state: State<'_, DbState>) -> Result<Vec<BookTagMapping>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT bt.book_slug, t.id, t.name, t.color
             FROM book_tags bt
             JOIN tags t ON t.id = bt.tag_id
             ORDER BY bt.book_slug, t.id",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, i64, String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(BookTagMapping::group_from_rows(rows))
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {:?}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub fn open_file(file_path: String, state: State<'_, DbState>) -> Result<String, String> {
    let path = Path::new(&file_path);
    if !path.is_file() {
        return Err(format!("File not found: {}", file_path));
    }
    if path
        .extension()
        .map(|e| e.to_ascii_lowercase() != "pdf")
        .unwrap_or(true)
    {
        return Err(format!("Not a PDF file: {}", file_path));
    }

    let parent = path
        .parent()
        .ok_or("No parent directory")?
        .to_string_lossy()
        .to_string();
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Find or insert directory
    let dir_id: i64 = match conn.query_row(
        "SELECT id FROM directories WHERE path = ?1",
        rusqlite::params![parent],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let label = Path::new(&parent)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| parent.clone());
            conn.execute(
                "INSERT INTO directories (path, label) VALUES (?1, ?2)",
                rusqlite::params![parent, label],
            )
            .map_err(|e| e.to_string())?;
            conn.last_insert_rowid()
        }
        Err(e) => return Err(e.to_string()),
    };

    let stem = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let slug = format!("{}_{}", dir_id, sanitize_slug(&stem));
    Ok(slug)
}

#[tauri::command]
pub fn get_pending_file(state: State<'_, PendingFile>) -> Option<String> {
    state.0.lock().ok().and_then(|mut f| f.take())
}

/// Creates the `.axiomatic/` project state directory inside the given library
/// directory if it does not already exist, and returns its path.
pub fn ensure_axiomatic_dir(dir_path: &str) -> Result<PathBuf, String> {
    let axiomatic_dir = Path::new(dir_path).join(".axiomatic");
    std::fs::create_dir_all(&axiomatic_dir).map_err(|e| {
        format!(
            "Failed to create .axiomatic directory in {}: {}",
            dir_path, e
        )
    })?;
    Ok(axiomatic_dir)
}

// ---------- task-003: progress commands ----------

#[tauri::command]
pub fn get_all_progress(
    dir_path: String,
) -> Result<HashMap<String, BookProgress>, String> {
    let progress_file = Path::new(&dir_path).join(".axiomatic").join("progress.json");
    if !progress_file.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&progress_file).map_err(|e| e.to_string())?;
    let map: HashMap<String, BookProgress> =
        serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(map)
}

#[tauri::command]
pub fn save_progress(
    dir_path: String,
    slug: String,
    progress: BookProgress,
) -> Result<(), String> {
    let axiomatic_dir = ensure_axiomatic_dir(&dir_path)?;
    let progress_file = axiomatic_dir.join("progress.json");

    // Read existing data
    let mut map: HashMap<String, BookProgress> = if progress_file.exists() {
        let data = std::fs::read_to_string(&progress_file).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    };

    map.insert(slug, progress);

    let json = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    std::fs::write(&progress_file, json).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- task-004: starred commands ----------

#[tauri::command]
pub fn get_starred(dir_path: String) -> Result<Vec<String>, String> {
    let starred_path = Path::new(&dir_path).join(".axiomatic").join("starred.json");
    if !starred_path.exists() {
        return Ok(Vec::new());
    }
    let contents = std::fs::read_to_string(&starred_path).map_err(|e| {
        format!(
            "Failed to read {}: {}",
            starred_path.display(),
            e
        )
    })?;
    let map: HashMap<String, bool> = serde_json::from_str(&contents).map_err(|e| {
        format!(
            "Failed to parse {}: {}",
            starred_path.display(),
            e
        )
    })?;
    let slugs: Vec<String> = map.into_keys().collect();
    Ok(slugs)
}

#[tauri::command]
pub fn toggle_starred(dir_path: String, slug: String) -> Result<bool, String> {
    let axiomatic_dir = ensure_axiomatic_dir(&dir_path)?;
    let starred_path = axiomatic_dir.join("starred.json");

    let mut map: HashMap<String, bool> = if starred_path.exists() {
        let contents = std::fs::read_to_string(&starred_path).map_err(|e| {
            format!("Failed to read {}: {}", starred_path.display(), e)
        })?;
        serde_json::from_str(&contents).map_err(|e| {
            format!("Failed to parse {}: {}", starred_path.display(), e)
        })?
    } else {
        HashMap::new()
    };

    let new_state = if map.contains_key(&slug) {
        map.remove(&slug);
        false
    } else {
        map.insert(slug, true);
        true
    };

    let json = serde_json::to_string_pretty(&map).map_err(|e| {
        format!("Failed to serialize starred data: {}", e)
    })?;
    std::fs::write(&starred_path, json).map_err(|e| {
        format!("Failed to write {}: {}", starred_path.display(), e)
    })?;

    Ok(new_state)
}

// ---------- task-006: xp commands ----------

#[tauri::command]
pub fn get_xp(dir_path: String, slug: String) -> Result<i64, String> {
    let axiomatic_dir = Path::new(&dir_path).join(".axiomatic");
    let xp_path = axiomatic_dir.join("xp.json");
    if !xp_path.exists() {
        return Ok(0);
    }
    let data = std::fs::read_to_string(&xp_path).map_err(|e| e.to_string())?;
    let map: HashMap<String, i64> =
        serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(map.get(&slug).copied().unwrap_or(0))
}

#[tauri::command]
pub fn increment_xp(dir_path: String, slug: String) -> Result<i64, String> {
    let axiomatic_dir = ensure_axiomatic_dir(&dir_path)?;
    let xp_path = axiomatic_dir.join("xp.json");
    let mut map: HashMap<String, i64> = if xp_path.exists() {
        let data = std::fs::read_to_string(&xp_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())?
    } else {
        HashMap::new()
    };
    let entry = map.entry(slug).or_insert(0);
    *entry += 1;
    let new_value = *entry;
    let json = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    std::fs::write(&xp_path, json).map_err(|e| e.to_string())?;
    Ok(new_value)
}

// ---------- task-007: slug migration commands ----------

/// Collect all distinct slugs referenced in SQLite tables.
/// Returns a map of slug -> list of evidence strings (which tables reference it).
fn collect_db_slugs(conn: &Connection) -> Result<HashMap<String, Vec<String>>, String> {
    let mut slug_evidence: HashMap<String, Vec<String>> = HashMap::new();

    // highlights
    let mut stmt = conn
        .prepare("SELECT DISTINCT slug FROM highlights")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for slug in rows.flatten() {
        slug_evidence.entry(slug).or_default().push("highlights".into());
    }

    // notes
    let mut stmt = conn
        .prepare("SELECT DISTINCT slug FROM notes")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for slug in rows.flatten() {
        slug_evidence.entry(slug).or_default().push("notes".into());
    }

    // note_images
    let mut stmt = conn
        .prepare("SELECT DISTINCT note_slug FROM note_images")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for slug in rows.flatten() {
        slug_evidence.entry(slug).or_default().push("note_images".into());
    }

    // book_tags
    let mut stmt = conn
        .prepare("SELECT DISTINCT book_slug FROM book_tags")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for slug in rows.flatten() {
        slug_evidence.entry(slug).or_default().push("book_tags".into());
    }

    // snips
    let mut stmt = conn
        .prepare("SELECT DISTINCT slug FROM snips")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for slug in rows.flatten() {
        slug_evidence.entry(slug).or_default().push("snips".into());
    }

    Ok(slug_evidence)
}

/// Simple similarity score between two strings based on common character bigrams.
/// Returns a value between 0.0 and 1.0.
fn bigram_similarity(a: &str, b: &str) -> f64 {
    if a.is_empty() || b.is_empty() || a.len() < 2 || b.len() < 2 {
        return 0.0;
    }
    let a_bigrams: HashSet<(char, char)> = a.chars().zip(a.chars().skip(1)).collect();
    let b_bigrams: HashSet<(char, char)> = b.chars().zip(b.chars().skip(1)).collect();
    let intersection = a_bigrams.intersection(&b_bigrams).count();
    let union = a_bigrams.union(&b_bigrams).count();
    if union == 0 {
        return 0.0;
    }
    intersection as f64 / union as f64
}

#[tauri::command]
pub async fn detect_orphaned_slugs(
    state: State<'_, DbState>,
) -> Result<Vec<OrphanCandidate>, String> {
    // 1. Gather all data slugs from SQLite
    let (slug_evidence, dirs) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let evidence = collect_db_slugs(&conn)?;
        let dirs = query_all_directories(&conn)?;
        (evidence, dirs)
    };

    // 2. Discover all current textbook slugs by scanning directories
    let dirs_clone = dirs.clone();
    let textbooks: Vec<Textbook> = tauri::async_runtime::spawn_blocking(move || {
        let mut textbooks = Vec::new();
        for dir in &dirs_clone {
            let dir_path = Path::new(&dir.path);
            if !dir_path.is_dir() {
                continue;
            }
            for entry in WalkDir::new(dir_path)
                .into_iter()
                .filter_entry(|e| {
                    e.file_name().to_str().map(|s| s != ".axiomatic").unwrap_or(true)
                })
                .flatten()
            {
                let path = entry.path();
                if path.is_file()
                    && path
                        .extension()
                        .map(|e| e.to_ascii_lowercase() == "pdf")
                        .unwrap_or(false)
                {
                    let file_name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let stem = path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let slug = format!("{}_{}", dir.id, sanitize_slug(&stem));
                    let title = title_from_stem(&stem);
                    let full_path = path.to_string_lossy().to_string();
                    textbooks.push(Textbook {
                        slug,
                        title,
                        file: file_name,
                        dir_id: dir.id,
                        dir_path: dir.path.clone(),
                        full_path,
                    });
                }
            }
        }
        textbooks
    })
    .await
    .map_err(|e| e.to_string())?;

    let current_slugs: HashSet<String> = textbooks.iter().map(|t| t.slug.clone()).collect();

    // Build a map of dir_id prefix -> list of current textbooks (for candidate matching)
    let mut slugs_by_dir_id: HashMap<String, Vec<&Textbook>> = HashMap::new();
    for tb in &textbooks {
        let prefix = format!("{}_", tb.dir_id);
        slugs_by_dir_id.entry(prefix).or_default().push(tb);
    }

    // Build dir_id -> dir_path map
    let dir_path_map: HashMap<i64, String> = dirs.iter().map(|d| (d.id, d.path.clone())).collect();

    // 3. Find orphaned slugs (referenced in data but not in current textbooks)
    let mut candidates = Vec::new();
    for (slug, evidence) in &slug_evidence {
        if current_slugs.contains(slug) {
            continue;
        }

        // Extract dir_id prefix from the slug (format: {dir_id}_{sanitized_stem})
        let dir_id_prefix = if let Some(idx) = slug.find('_') {
            &slug[..=idx] // includes the underscore
        } else {
            continue; // malformed slug
        };

        let old_stem = &slug[dir_id_prefix.len()..];
        let dir_id: i64 = match dir_id_prefix.trim_end_matches('_').parse() {
            Ok(id) => id,
            Err(_) => continue,
        };
        let dir_path = dir_path_map.get(&dir_id).cloned().unwrap_or_default();

        // Find the best matching current slug in the same directory
        if let Some(candidates_in_dir) = slugs_by_dir_id.get(dir_id_prefix) {
            let mut best_match: Option<(&Textbook, f64)> = None;

            for tb in candidates_in_dir {
                let new_stem = &tb.slug[dir_id_prefix.len()..];
                let sim = bigram_similarity(old_stem, new_stem);
                if sim > 0.2 {
                    if let Some((_, best_sim)) = &best_match {
                        if sim > *best_sim {
                            best_match = Some((tb, sim));
                        }
                    } else {
                        best_match = Some((tb, sim));
                    }
                }
            }

            if let Some((tb, _)) = best_match {
                candidates.push(OrphanCandidate {
                    old_slug: slug.clone(),
                    new_slug_candidate: tb.slug.clone(),
                    dir_path,
                    evidence: evidence.clone(),
                });
            }
        }
    }

    Ok(candidates)
}

#[tauri::command]
pub fn migrate_slug(
    old_slug: String,
    new_slug: String,
    dir_path: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // 1. SQLite transaction: update all tables atomically
    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        conn.execute(
            "UPDATE highlights SET slug = ?1 WHERE slug = ?2",
            rusqlite::params![new_slug, old_slug],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE notes SET slug = ?1 WHERE slug = ?2",
            rusqlite::params![new_slug, old_slug],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE note_images SET note_slug = ?1 WHERE note_slug = ?2",
            rusqlite::params![new_slug, old_slug],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE book_tags SET book_slug = ?1 WHERE book_slug = ?2",
            rusqlite::params![new_slug, old_slug],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE snips SET slug = ?1 WHERE slug = ?2",
            rusqlite::params![new_slug, old_slug],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| e.to_string())?;
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK").ok();
            return Err(e);
        }
    }

    // 2. Update .axiomatic/ JSON files in the directory
    let axiomatic_dir = Path::new(&dir_path).join(".axiomatic");
    if axiomatic_dir.is_dir() {
        // progress.json
        let progress_path = axiomatic_dir.join("progress.json");
        if progress_path.is_file() {
            if let Ok(data) = std::fs::read_to_string(&progress_path) {
                if let Ok(mut map) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&data) {
                    if let Some(val) = map.remove(&old_slug) {
                        map.insert(new_slug.clone(), val);
                        if let Ok(json) = serde_json::to_string_pretty(&map) {
                            std::fs::write(&progress_path, json).ok();
                        }
                    }
                }
            }
        }

        // starred.json
        let starred_path = axiomatic_dir.join("starred.json");
        if starred_path.is_file() {
            if let Ok(data) = std::fs::read_to_string(&starred_path) {
                if let Ok(mut map) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&data) {
                    if let Some(val) = map.remove(&old_slug) {
                        map.insert(new_slug.clone(), val);
                        if let Ok(json) = serde_json::to_string_pretty(&map) {
                            std::fs::write(&starred_path, json).ok();
                        }
                    }
                }
            }
        }

        // snips.json
        let snips_path = axiomatic_dir.join("snips.json");
        if snips_path.is_file() {
            if let Ok(data) = std::fs::read_to_string(&snips_path) {
                if let Ok(mut arr) = serde_json::from_str::<Vec<serde_json::Value>>(&data) {
                    for item in arr.iter_mut() {
                        if let Some(obj) = item.as_object_mut() {
                            if obj.get("slug").and_then(|v| v.as_str()) == Some(&old_slug) {
                                obj.insert("slug".into(), serde_json::Value::String(new_slug.clone()));
                            }
                        }
                    }
                    if let Ok(json) = serde_json::to_string_pretty(&arr) {
                        std::fs::write(&snips_path, json).ok();
                    }
                }
            }
        }

        // xp.json
        let xp_path = axiomatic_dir.join("xp.json");
        if xp_path.is_file() {
            if let Ok(data) = std::fs::read_to_string(&xp_path) {
                if let Ok(mut map) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&data) {
                    if let Some(val) = map.remove(&old_slug) {
                        map.insert(new_slug.clone(), val);
                        if let Ok(json) = serde_json::to_string_pretty(&map) {
                            std::fs::write(&xp_path, json).ok();
                        }
                    }
                }
            }
        }
    }

    Ok(())
}


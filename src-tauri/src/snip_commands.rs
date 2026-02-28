use std::path::Path;

use crate::commands::ensure_axiomatic_dir;
use crate::models::Snip;

const SNIPS_FILE: &str = "snips.json";

/// Read all snips from the JSON file, returning an empty vec if the file does
/// not exist or is unreadable.
fn read_snips_file(dir_path: &str) -> Vec<Snip> {
    let path = Path::new(dir_path).join(".axiomatic").join(SNIPS_FILE);
    match std::fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// Write the full snips array back to the JSON file.
fn write_snips_file(dir_path: &str, snips: &[Snip]) -> Result<(), String> {
    let axiomatic_dir = ensure_axiomatic_dir(dir_path)?;
    let path = axiomatic_dir.join(SNIPS_FILE);
    let json = serde_json::to_string_pretty(snips).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| {
        format!("Failed to write {}: {}", path.display(), e)
    })
}

#[tauri::command]
pub fn list_snips(dir_path: String, slug: String) -> Result<Vec<Snip>, String> {
    let all = read_snips_file(&dir_path);
    let filtered: Vec<Snip> = all.into_iter().filter(|s| s.slug == slug).collect();
    Ok(filtered)
}

#[tauri::command]
pub fn create_snip(
    dir_path: String,
    slug: String,
    full_path: String,
    page: i64,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<Snip, String> {
    let mut all = read_snips_file(&dir_path);
    let now = chrono_now();
    let snip = Snip {
        id: uuid::Uuid::new_v4().to_string(),
        slug,
        full_path,
        page,
        label,
        x,
        y,
        width,
        height,
        created_at: now,
    };
    all.push(snip.clone());
    write_snips_file(&dir_path, &all)?;
    Ok(snip)
}

#[tauri::command]
pub fn delete_snip(dir_path: String, id: String) -> Result<(), String> {
    let mut all = read_snips_file(&dir_path);
    let before = all.len();
    all.retain(|s| s.id != id);
    if all.len() == before {
        // Snip not found is not an error -- idempotent delete
        return Ok(());
    }
    write_snips_file(&dir_path, &all)
}

/// Generate an ISO-8601 timestamp without pulling in the chrono crate.
fn chrono_now() -> String {
    // Use std::time to produce a simple UTC timestamp
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    // Convert to a basic ISO-8601 string: YYYY-MM-DDTHH:MM:SSZ
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Days since 1970-01-01
    let mut y = 1970i64;
    let mut remaining_days = days as i64;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }
    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut m = 0usize;
    for (i, &md) in month_days.iter().enumerate() {
        if remaining_days < md as i64 {
            m = i;
            break;
        }
        remaining_days -= md as i64;
    }
    let d = remaining_days + 1;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y,
        m + 1,
        d,
        hours,
        minutes,
        seconds
    )
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}

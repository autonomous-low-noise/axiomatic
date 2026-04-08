use std::path::Path;

use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::commands::ensure_axiomatic_dir;

/// Read a JSON file from `.axiomatic/{filename}` in the given directory.
/// Returns `T::default()` if the file does not exist or is unreadable.
pub fn read_json<T: DeserializeOwned + Default>(dir_path: &str, filename: &str) -> T {
    let path = Path::new(dir_path).join(".axiomatic").join(filename);
    match std::fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => T::default(),
    }
}

/// Write a value as pretty JSON to `.axiomatic/{filename}` in the given directory.
/// Creates the `.axiomatic/` directory if it doesn't exist.
pub fn write_json<T: Serialize>(dir_path: &str, filename: &str, data: &T) -> Result<(), String> {
    let axiomatic_dir = ensure_axiomatic_dir(dir_path)?;
    let path = axiomatic_dir.join(filename);
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

/// Read-modify-write a JSON file atomically (read → apply closure → write back).
/// Reduces the boilerplate of loading, mutating, and saving JSON in every command.
pub fn update_json<T, F>(dir_path: &str, filename: &str, f: F) -> Result<(), String>
where
    T: DeserializeOwned + Default + Serialize,
    F: FnOnce(&mut T) -> Result<(), String>,
{
    let mut data: T = read_json(dir_path, filename);
    f(&mut data)?;
    write_json(dir_path, filename, &data)
}

/// Read a JSON file, returning None if it doesn't exist.
/// Unlike `read_json`, this doesn't require Default.
pub fn read_json_opt<T: DeserializeOwned>(dir_path: &str, filename: &str) -> Option<T> {
    let path = Path::new(dir_path).join(".axiomatic").join(filename);
    let contents = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&contents).ok()
}

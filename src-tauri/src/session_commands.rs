use std::collections::HashMap;

use crate::json_storage::{read_json, write_json};
use crate::models::{SessionEntry, StudySession};

const SESSIONS_FILE: &str = "sessions.json";
const POMODORO_XP_FILE: &str = "pomodoro-xp.json";

#[tauri::command]
pub fn log_study_session(sessions: Vec<SessionEntry>) -> Result<(), String> {
    for entry in sessions {
        let mut all: Vec<StudySession> = read_json(&entry.dir_path, SESSIONS_FILE);
        all.push(entry.session);
        write_json(&entry.dir_path, SESSIONS_FILE, &all)?;
    }
    Ok(())
}

#[tauri::command]
pub fn increment_pomodoro_xp(dir_path: String, slug: String) -> Result<i64, String> {
    let mut map: HashMap<String, i64> = read_json(&dir_path, POMODORO_XP_FILE);
    let entry = map.entry(slug).or_insert(0);
    *entry += 1;
    let new_value = *entry;
    write_json(&dir_path, POMODORO_XP_FILE, &map)?;
    Ok(new_value)
}

#[tauri::command]
pub fn get_pomodoro_xp(dir_path: String, slug: String) -> Result<i64, String> {
    let map: HashMap<String, i64> = read_json(&dir_path, POMODORO_XP_FILE);
    Ok(map.get(&slug).copied().unwrap_or(0))
}

#[tauri::command]
pub fn list_study_sessions(dir_path: String) -> Result<Vec<StudySession>, String> {
    Ok(read_json(&dir_path, SESSIONS_FILE))
}

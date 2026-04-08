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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{SessionEntry, StudySession, StudySessionBook};

    #[test]
    fn test_log_and_list_sessions() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        let entries = vec![
            SessionEntry {
                dir_path: dp.clone(),
                session: StudySession {
                    id: "sess-1".into(),
                    started_at: "2025-01-01T10:00:00Z".into(),
                    ended_at: "2025-01-01T10:25:00Z".into(),
                    duration_minutes: 25,
                    books: vec![StudySessionBook {
                        slug: "algebra".into(),
                        dir_path: dp.clone(),
                    }],
                },
            },
            SessionEntry {
                dir_path: dp.clone(),
                session: StudySession {
                    id: "sess-2".into(),
                    started_at: "2025-01-01T11:00:00Z".into(),
                    ended_at: "2025-01-01T11:50:00Z".into(),
                    duration_minutes: 50,
                    books: vec![StudySessionBook {
                        slug: "topology".into(),
                        dir_path: dp.clone(),
                    }],
                },
            },
        ];

        log_study_session(entries).unwrap();

        let sessions = list_study_sessions(dp).unwrap();
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].id, "sess-1");
        assert_eq!(sessions[0].duration_minutes, 25);
        assert_eq!(sessions[0].books[0].slug, "algebra");
        assert_eq!(sessions[1].id, "sess-2");
        assert_eq!(sessions[1].duration_minutes, 50);
        assert_eq!(sessions[1].books[0].slug, "topology");
    }

    #[test]
    fn test_increment_pomodoro_xp() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        let v1 = increment_pomodoro_xp(dp.clone(), "algebra".into()).unwrap();
        assert_eq!(v1, 1);

        let v2 = increment_pomodoro_xp(dp.clone(), "algebra".into()).unwrap();
        assert_eq!(v2, 2);

        let current = get_pomodoro_xp(dp, "algebra".into()).unwrap();
        assert_eq!(current, 2);
    }

    #[test]
    fn test_get_pomodoro_xp_default() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        let xp = get_pomodoro_xp(dp, "nonexistent".into()).unwrap();
        assert_eq!(xp, 0);
    }
}

use crate::json_storage::{read_json, write_json, update_json};
use crate::models::{Snip, SnipTagDef};

const SNIPS_FILE: &str = "snips.json";
const SNIP_TAG_DEFS_FILE: &str = "snip-tag-defs.json";
const VALID_SNIP_STATUSES: &[&str] = &["open", "solid", "attention"];

fn validate_snip_status(status: &str) -> Result<(), String> {
    if VALID_SNIP_STATUSES.contains(&status) {
        Ok(())
    } else {
        Err(format!("Invalid snip status '{}'. Must be one of: {}", status, VALID_SNIP_STATUSES.join(", ")))
    }
}

#[tauri::command]
pub fn list_snips(dir_path: String, slug: String) -> Result<Vec<Snip>, String> {
    let all: Vec<Snip> = read_json(&dir_path, SNIPS_FILE);
    Ok(all.into_iter().filter(|s| s.slug == slug).collect())
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
    let mut all: Vec<Snip> = read_json(&dir_path, SNIPS_FILE);
    let now = now_iso8601();
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
        tags: Vec::new(),
        status: "open".into(),
    };
    all.push(snip.clone());
    write_json(&dir_path, SNIPS_FILE, &all)?;
    Ok(snip)
}

#[tauri::command]
pub fn delete_snip(dir_path: String, id: String) -> Result<(), String> {
    let mut all: Vec<Snip> = read_json(&dir_path, SNIPS_FILE);
    let before = all.len();
    all.retain(|s| s.id != id);
    if all.len() == before {
        // Snip not found is not an error -- idempotent delete
        return Ok(());
    }
    write_json(&dir_path, SNIPS_FILE, &all)
}

#[tauri::command]
pub fn list_all_snips(dir_path: String) -> Result<Vec<Snip>, String> {
    Ok(read_json(&dir_path, SNIPS_FILE))
}

#[tauri::command]
pub fn add_snip_tag(dir_path: String, snip_id: String, tag: String) -> Result<(), String> {
    update_json::<Vec<Snip>, _>(&dir_path, SNIPS_FILE, |all| {
        let snip = all.iter_mut().find(|s| s.id == snip_id)
            .ok_or_else(|| format!("Snip not found: {}", snip_id))?;
        if !snip.tags.contains(&tag) { snip.tags.push(tag); }
        Ok(())
    })
}

#[tauri::command]
pub fn remove_snip_tag(dir_path: String, snip_id: String, tag: String) -> Result<(), String> {
    update_json::<Vec<Snip>, _>(&dir_path, SNIPS_FILE, |all| {
        let snip = all.iter_mut().find(|s| s.id == snip_id)
            .ok_or_else(|| format!("Snip not found: {}", snip_id))?;
        snip.tags.retain(|t| t != &tag);
        Ok(())
    })
}

#[tauri::command]
pub fn list_all_snip_tags(dir_path: String) -> Result<Vec<String>, String> {
    let all: Vec<Snip> = read_json(&dir_path, SNIPS_FILE);
    let mut tags: Vec<String> = all
        .iter()
        .flat_map(|s| s.tags.iter().cloned())
        .collect();
    tags.sort();
    tags.dedup();
    Ok(tags)
}

#[tauri::command]
pub fn rename_snip(dir_path: String, snip_id: String, new_label: String) -> Result<(), String> {
    update_json::<Vec<Snip>, _>(&dir_path, SNIPS_FILE, |all| {
        let snip = all.iter_mut().find(|s| s.id == snip_id)
            .ok_or_else(|| format!("Snip not found: {}", snip_id))?;
        snip.label = new_label;
        Ok(())
    })
}

#[tauri::command]
pub fn bulk_add_snip_tag(dir_path: String, snip_ids: Vec<String>, tag: String) -> Result<(), String> {
    update_json::<Vec<Snip>, _>(&dir_path, SNIPS_FILE, |all| {
        for snip in all.iter_mut().filter(|s| snip_ids.contains(&s.id)) {
            if !snip.tags.contains(&tag) { snip.tags.push(tag.clone()); }
        }
        Ok(())
    })
}

#[tauri::command]
pub fn bulk_remove_snip_tag(dir_path: String, snip_ids: Vec<String>, tag: String) -> Result<(), String> {
    update_json::<Vec<Snip>, _>(&dir_path, SNIPS_FILE, |all| {
        for snip in all.iter_mut().filter(|s| snip_ids.contains(&s.id)) {
            snip.tags.retain(|t| t != &tag);
        }
        Ok(())
    })
}

#[tauri::command]
pub fn set_snip_status(dir_path: String, snip_id: String, status: String) -> Result<(), String> {
    validate_snip_status(&status)?;
    update_json::<Vec<Snip>, _>(&dir_path, SNIPS_FILE, |all| {
        let snip = all.iter_mut().find(|s| s.id == snip_id)
            .ok_or_else(|| format!("Snip not found: {}", snip_id))?;
        snip.status = status;
        Ok(())
    })
}

#[tauri::command]
pub fn bulk_set_snip_status(dir_path: String, snip_ids: Vec<String>, status: String) -> Result<(), String> {
    validate_snip_status(&status)?;
    update_json::<Vec<Snip>, _>(&dir_path, SNIPS_FILE, |all| {
        for snip in all.iter_mut().filter(|s| snip_ids.contains(&s.id)) {
            snip.status = status.clone();
        }
        Ok(())
    })
}

#[tauri::command]
pub fn get_snip_status_counts(dir_path: String) -> Result<std::collections::HashMap<String, (i64, i64)>, String> {
    let all: Vec<Snip> = read_json(&dir_path, SNIPS_FILE);
    let mut counts: std::collections::HashMap<String, (i64, i64)> = std::collections::HashMap::new();
    for snip in &all {
        let entry = counts.entry(snip.slug.clone()).or_insert((0, 0));
        entry.0 += 1;
        if snip.status == "solid" { entry.1 += 1; }
    }
    Ok(counts)
}

#[tauri::command]
pub fn list_snip_tag_defs(dir_path: String) -> Result<Vec<SnipTagDef>, String> {
    Ok(read_json(&dir_path, SNIP_TAG_DEFS_FILE))
}

#[tauri::command]
pub fn create_snip_tag_def(dir_paths: Vec<String>, name: String, color: String) -> Result<(), String> {
    for dir_path in &dir_paths {
        let mut defs: Vec<SnipTagDef> = read_json(dir_path, SNIP_TAG_DEFS_FILE);
        if !defs.iter().any(|d| d.name == name) {
            defs.push(SnipTagDef { name: name.clone(), color: color.clone() });
            write_json(dir_path, SNIP_TAG_DEFS_FILE, &defs)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_snip_tag_def(dir_paths: Vec<String>, name: String) -> Result<(), String> {
    for dir_path in &dir_paths {
        // Remove from defs
        let mut defs: Vec<SnipTagDef> = read_json(dir_path, SNIP_TAG_DEFS_FILE);
        defs.retain(|d| d.name != name);
        write_json(dir_path, SNIP_TAG_DEFS_FILE, &defs)?;
        // Strip tag from all snips
        let mut snips: Vec<Snip> = read_json(dir_path, SNIPS_FILE);
        for snip in &mut snips {
            snip.tags.retain(|t| t != &name);
        }
        write_json(dir_path, SNIPS_FILE, &snips)?;
    }
    Ok(())
}

#[tauri::command]
pub fn rename_snip_tag_def(dir_paths: Vec<String>, old_name: String, new_name: String) -> Result<(), String> {
    for dir_path in &dir_paths {
        // Rename in defs
        let mut defs: Vec<SnipTagDef> = read_json(dir_path, SNIP_TAG_DEFS_FILE);
        for def in &mut defs {
            if def.name == old_name {
                def.name = new_name.clone();
            }
        }
        write_json(dir_path, SNIP_TAG_DEFS_FILE, &defs)?;
        // Update refs in snips
        let mut snips: Vec<Snip> = read_json(dir_path, SNIPS_FILE);
        for snip in &mut snips {
            for tag in &mut snip.tags {
                if tag == &old_name {
                    *tag = new_name.clone();
                }
            }
        }
        write_json(dir_path, SNIPS_FILE, &snips)?;
    }
    Ok(())
}

#[tauri::command]
pub fn recolor_snip_tag_def(dir_paths: Vec<String>, name: String, color: String) -> Result<(), String> {
    for dir_path in &dir_paths {
        let mut defs: Vec<SnipTagDef> = read_json(dir_path, SNIP_TAG_DEFS_FILE);
        for def in &mut defs {
            if def.name == name {
                def.color = color.clone();
            }
        }
        write_json(dir_path, SNIP_TAG_DEFS_FILE, &defs)?;
    }
    Ok(())
}

fn now_iso8601() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ================================================================
    // ac-122: Snip CRUD round-trip
    // ================================================================

    #[test]
    fn create_list_delete_snip_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let dir_path = dir.path().to_string_lossy().to_string();

        // Initially empty
        let snips = list_snips(dir_path.clone(), "book-a".into()).unwrap();
        assert!(snips.is_empty());

        // Create a snip
        let snip = create_snip(
            dir_path.clone(),
            "book-a".into(),
            "/path/to/book.pdf".into(),
            3,
            "Definition 2.1".into(),
            0.1,
            0.2,
            0.5,
            0.3,
        ).unwrap();

        // Verify the created snip
        assert!(!snip.id.is_empty(), "ID should be a UUID string");
        assert_eq!(snip.slug, "book-a");
        assert_eq!(snip.full_path, "/path/to/book.pdf");
        assert_eq!(snip.page, 3);
        assert_eq!(snip.label, "Definition 2.1");
        assert!((snip.x - 0.1).abs() < f64::EPSILON);
        assert!((snip.y - 0.2).abs() < f64::EPSILON);
        assert!((snip.width - 0.5).abs() < f64::EPSILON);
        assert!((snip.height - 0.3).abs() < f64::EPSILON);
        assert!(!snip.created_at.is_empty(), "created_at should be set");
        // Verify UUID format (contains hyphens, 36 chars)
        assert_eq!(snip.id.len(), 36);
        assert_eq!(snip.id.chars().filter(|&c| c == '-').count(), 4);

        // List should return the snip
        let snips = list_snips(dir_path.clone(), "book-a".into()).unwrap();
        assert_eq!(snips.len(), 1);
        assert_eq!(snips[0].id, snip.id);
        assert_eq!(snips[0].label, "Definition 2.1");

        // Delete it
        delete_snip(dir_path.clone(), snip.id.clone()).unwrap();

        // List should be empty again
        let snips = list_snips(dir_path, "book-a".into()).unwrap();
        assert!(snips.is_empty());
    }

    #[test]
    fn list_snips_filters_by_slug() {
        let dir = tempfile::tempdir().unwrap();
        let dir_path = dir.path().to_string_lossy().to_string();

        create_snip(
            dir_path.clone(), "book-a".into(), "/a.pdf".into(),
            1, "snip a".into(), 0.0, 0.0, 1.0, 1.0,
        ).unwrap();
        create_snip(
            dir_path.clone(), "book-b".into(), "/b.pdf".into(),
            1, "snip b".into(), 0.0, 0.0, 1.0, 1.0,
        ).unwrap();

        let a_snips = list_snips(dir_path.clone(), "book-a".into()).unwrap();
        assert_eq!(a_snips.len(), 1);
        assert_eq!(a_snips[0].label, "snip a");

        let b_snips = list_snips(dir_path, "book-b".into()).unwrap();
        assert_eq!(b_snips.len(), 1);
        assert_eq!(b_snips[0].label, "snip b");
    }

    #[test]
    fn delete_snip_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let dir_path = dir.path().to_string_lossy().to_string();

        // Deleting a nonexistent snip should succeed
        let result = delete_snip(dir_path, "nonexistent-id".into());
        assert!(result.is_ok());
    }

    #[test]
    fn snips_json_persists_on_disk() {
        let dir = tempfile::tempdir().unwrap();
        let dir_path = dir.path().to_string_lossy().to_string();

        create_snip(
            dir_path.clone(), "book-a".into(), "/a.pdf".into(),
            1, "persisted".into(), 0.0, 0.0, 1.0, 1.0,
        ).unwrap();

        // Verify the file exists on disk
        let snips_path = dir.path().join(".axiomatic").join("snips.json");
        assert!(snips_path.exists());

        // Verify the JSON content is valid
        let data = std::fs::read_to_string(&snips_path).unwrap();
        let parsed: Vec<Snip> = serde_json::from_str(&data).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].label, "persisted");
    }

    // ================================================================
    // Snip rename
    // ================================================================

    #[test]
    fn test_rename_snip() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        let snip = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 1, "old".into(), 0.0, 0.0, 1.0, 1.0).unwrap();
        rename_snip(dp.clone(), snip.id.clone(), "new label".into()).unwrap();

        let snips = list_all_snips(dp).unwrap();
        assert_eq!(snips[0].label, "new label");
    }

    // ================================================================
    // Bulk tag operations
    // ================================================================

    #[test]
    fn test_bulk_add_snip_tag() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        let s1 = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 1, "a".into(), 0.0, 0.0, 1.0, 1.0).unwrap();
        let s2 = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 2, "b".into(), 0.0, 0.0, 1.0, 1.0).unwrap();
        let s3 = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 3, "c".into(), 0.0, 0.0, 1.0, 1.0).unwrap();

        // Bulk add to s1 and s3 only
        bulk_add_snip_tag(dp.clone(), vec![s1.id.clone(), s3.id.clone()], "important".into()).unwrap();

        let snips = list_all_snips(dp).unwrap();
        let find = |id: &str| snips.iter().find(|s| s.id == id).unwrap();
        assert_eq!(find(&s1.id).tags, vec!["important"]);
        assert!(find(&s2.id).tags.is_empty());
        assert_eq!(find(&s3.id).tags, vec!["important"]);
    }

    #[test]
    fn test_bulk_add_tag_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        let s1 = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 1, "a".into(), 0.0, 0.0, 1.0, 1.0).unwrap();
        add_snip_tag(dp.clone(), s1.id.clone(), "x".into()).unwrap();

        // Bulk add same tag again — should not duplicate
        bulk_add_snip_tag(dp.clone(), vec![s1.id.clone()], "x".into()).unwrap();

        let snips = list_all_snips(dp).unwrap();
        assert_eq!(snips[0].tags, vec!["x"]);
    }

    #[test]
    fn test_bulk_remove_snip_tag() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        let s1 = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 1, "a".into(), 0.0, 0.0, 1.0, 1.0).unwrap();
        let s2 = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 2, "b".into(), 0.0, 0.0, 1.0, 1.0).unwrap();
        add_snip_tag(dp.clone(), s1.id.clone(), "rm-me".into()).unwrap();
        add_snip_tag(dp.clone(), s2.id.clone(), "rm-me".into()).unwrap();
        add_snip_tag(dp.clone(), s2.id.clone(), "keep".into()).unwrap();

        bulk_remove_snip_tag(dp.clone(), vec![s1.id.clone(), s2.id.clone()], "rm-me".into()).unwrap();

        let snips = list_all_snips(dp).unwrap();
        let find = |id: &str| snips.iter().find(|s| s.id == id).unwrap();
        assert!(find(&s1.id).tags.is_empty());
        assert_eq!(find(&s2.id).tags, vec!["keep"]);
    }

    // ================================================================
    // Snip tag definitions CRUD
    // ================================================================

    #[test]
    fn test_create_and_list_snip_tag_defs() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        // Initially empty
        assert!(list_snip_tag_defs(dp.clone()).unwrap().is_empty());

        // Create defs (fan-out to single dir)
        create_snip_tag_def(vec![dp.clone()], "math".into(), "#dc322f".into()).unwrap();
        create_snip_tag_def(vec![dp.clone()], "physics".into(), "#268bd2".into()).unwrap();

        let defs = list_snip_tag_defs(dp.clone()).unwrap();
        assert_eq!(defs.len(), 2);
        assert_eq!(defs[0].name, "math");
        assert_eq!(defs[0].color, "#dc322f");
        assert_eq!(defs[1].name, "physics");

        // Creating duplicate is idempotent
        create_snip_tag_def(vec![dp.clone()], "math".into(), "#ffffff".into()).unwrap();
        assert_eq!(list_snip_tag_defs(dp).unwrap().len(), 2);
    }

    #[test]
    fn test_delete_snip_tag_def_strips_from_snips() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        create_snip_tag_def(vec![dp.clone()], "obsolete".into(), "#dc322f".into()).unwrap();
        let snip = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 1, "a".into(), 0.0, 0.0, 1.0, 1.0).unwrap();
        add_snip_tag(dp.clone(), snip.id.clone(), "obsolete".into()).unwrap();

        delete_snip_tag_def(vec![dp.clone()], "obsolete".into()).unwrap();

        // Def removed
        assert!(list_snip_tag_defs(dp.clone()).unwrap().is_empty());
        // Tag stripped from snip
        let snips = list_all_snips(dp).unwrap();
        assert!(snips[0].tags.is_empty());
    }

    #[test]
    fn test_rename_snip_tag_def_updates_snips() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        create_snip_tag_def(vec![dp.clone()], "old-tag".into(), "#dc322f".into()).unwrap();
        let snip = create_snip(dp.clone(), "s".into(), "/a.pdf".into(), 1, "a".into(), 0.0, 0.0, 1.0, 1.0).unwrap();
        add_snip_tag(dp.clone(), snip.id.clone(), "old-tag".into()).unwrap();

        rename_snip_tag_def(vec![dp.clone()], "old-tag".into(), "new-tag".into()).unwrap();

        // Def renamed
        let defs = list_snip_tag_defs(dp.clone()).unwrap();
        assert_eq!(defs[0].name, "new-tag");
        // Snip ref updated
        let snips = list_all_snips(dp).unwrap();
        assert_eq!(snips[0].tags, vec!["new-tag"]);
    }

    #[test]
    fn test_recolor_snip_tag_def() {
        let dir = tempfile::tempdir().unwrap();
        let dp = dir.path().to_string_lossy().to_string();

        create_snip_tag_def(vec![dp.clone()], "math".into(), "#dc322f".into()).unwrap();
        recolor_snip_tag_def(vec![dp.clone()], "math".into(), "#268bd2".into()).unwrap();

        let defs = list_snip_tag_defs(dp).unwrap();
        assert_eq!(defs[0].color, "#268bd2");
    }

    #[test]
    fn now_iso8601_returns_valid_timestamp() {
        let ts = now_iso8601();
        // Should match pattern YYYY-MM-DDTHH:MM:SSZ
        assert_eq!(ts.len(), 20);
        assert_eq!(&ts[4..5], "-");
        assert_eq!(&ts[7..8], "-");
        assert_eq!(&ts[10..11], "T");
        assert_eq!(&ts[13..14], ":");
        assert_eq!(&ts[16..17], ":");
        assert_eq!(&ts[19..20], "Z");
    }
}

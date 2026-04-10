use std::path::Path;
use crate::models::ModEntry;
use crate::icon;

pub fn list_profiles(base_path: &Path) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(base_path).map_err(|e| e.to_string())?;
    let mut names = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if meta.is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                let mods_path = base_path.join(name).join("mods.yml");
                if mods_path.exists() {
                    names.push(name.to_string());
                }
            }
        }
    }

    names.sort();
    Ok(names)
}

pub fn get_profile_mods(base_path: &Path, profile: &str) -> Result<Vec<ModEntry>, String> {
    let path = base_path.join(profile).join("mods.yml");
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut mods: Vec<ModEntry> = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let plugins_root = base_path.join(profile).join("BepInEx/plugins");
    for mod_entry in &mut mods {
        let has_icon = mod_entry
            .icon
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        if !has_icon {
            mod_entry.icon = icon::resolve_profile_icon(&plugins_root, mod_entry);
        }
    }

    Ok(mods)
}

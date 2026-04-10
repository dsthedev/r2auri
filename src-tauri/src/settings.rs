use std::path::PathBuf;
use crate::models::AppSettings;
use crate::utils::get_default_valheim_mods_path;

fn get_settings_file_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let config_dir = PathBuf::from(home).join(".config/r2auri");
    Ok(config_dir.join("settings.json"))
}

pub fn load_settings() -> Result<AppSettings, String> {
    let settings_path = get_settings_file_path()?;
    
    if !settings_path.exists() {
        // Return defaults with auto-detected path if possible
        return Ok(AppSettings {
            valheim_mods_path: get_default_valheim_mods_path().unwrap_or_default(),
            default_profile: String::new(),
        });
    }

    let content = std::fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let settings_path = get_settings_file_path()?;
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&settings_path, content).map_err(|e| e.to_string())
}

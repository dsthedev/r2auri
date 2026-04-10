mod icon;
mod log_output;
mod models;
mod profile;
mod config_index;
mod readme;
mod settings;
mod utils;

use std::path::PathBuf;
use models::{AppSettings, ModEntry, ProfileConfigIndex, ProfileLogSnapshot, TailChunk, TailSessionStart};
use log_output::TailSessionRegistry;

#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    settings::load_settings()
}

#[tauri::command]
fn set_settings(settings: AppSettings) -> Result<(), String> {
    settings::save_settings(&settings)
}

#[tauri::command]
fn get_default_mods_path() -> Result<String, String> {
    utils::get_default_valheim_mods_path()
        .ok_or_else(|| "Could not determine default Valheim mods path".to_string())
}

#[tauri::command]
fn list_profiles(mods_path: String) -> Result<Vec<String>, String> {
    let base_path = PathBuf::from(&mods_path);
    if !base_path.exists() || !base_path.is_dir() {
        return Err("Mods path does not exist or is not a directory".to_string());
    }
    profile::list_profiles(&base_path)
}

#[tauri::command]
fn get_profile_mods(mods_path: String, profile: String) -> Result<Vec<ModEntry>, String> {
    let base_path = PathBuf::from(&mods_path);
    profile::get_profile_mods(&base_path, &profile)
}

#[tauri::command]
fn get_profile_config_index(mods_path: String, profile: String) -> Result<ProfileConfigIndex, String> {
    let base_path = PathBuf::from(&mods_path);
    config_index::build_profile_config_index(&base_path, &profile)
}

#[tauri::command]
fn get_app_readme() -> Result<String, String> {
    readme::read_app_readme()
}

#[tauri::command]
fn get_mod_readme(mods_path: String, profile: String, mod_name: String) -> Result<String, String> {
    let base_path = PathBuf::from(&mods_path);
    let path = base_path.join(&profile).join("mods.yml");
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mods: Vec<ModEntry> = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
    let mod_entry = mods
        .iter()
        .find(|m| m.name == mod_name)
        .ok_or_else(|| format!("Mod not found in profile: {}", mod_name))?;

    let plugins_root = base_path.join(&profile).join("BepInEx/plugins");
    readme::read_mod_readme(&plugins_root, mod_entry)
}

#[tauri::command]
fn get_profile_log_snapshot(mods_path: String, profile: String) -> Result<ProfileLogSnapshot, String> {
    let base_path = PathBuf::from(&mods_path);
    log_output::get_profile_log_snapshot(&base_path, &profile)
}

#[tauri::command]
fn start_profile_log_tail(
    state: tauri::State<'_, TailSessionRegistry>,
    mods_path: String,
    profile: String,
) -> Result<TailSessionStart, String> {
    let base_path = PathBuf::from(&mods_path);
    log_output::start_tail_session(&base_path, &profile, state.inner())
}

#[tauri::command]
fn read_profile_log_tail(
    state: tauri::State<'_, TailSessionRegistry>,
    session_id: String,
) -> Result<TailChunk, String> {
    log_output::read_tail_chunk(&session_id, state.inner())
}

#[tauri::command]
fn stop_profile_log_tail(
    state: tauri::State<'_, TailSessionRegistry>,
    session_id: String,
) -> Result<(), String> {
    log_output::stop_tail_session(&session_id, state.inner())
}

#[tauri::command]
fn reveal_path_in_file_manager(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    utils::reveal_path_in_file_manager(&target)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(TailSessionRegistry::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_settings,
            get_default_mods_path,
            list_profiles,
            get_profile_mods,
            get_profile_config_index,
            get_app_readme,
            get_mod_readme,
            get_profile_log_snapshot,
            start_profile_log_tail,
            read_profile_log_tail,
            stop_profile_log_tail,
            reveal_path_in_file_manager
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

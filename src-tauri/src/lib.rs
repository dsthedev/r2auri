use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct VersionNumber {
    major: u32,
    minor: u32,
    patch: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct ModEntry {
    #[serde(default)]
    manifest_version: u32,
    name: String,
    author_name: String,
    display_name: String,
    description: String,
    website_url: String,
    version_number: VersionNumber,
    enabled: bool,
    #[serde(default)]
    dependencies: Vec<String>,
    #[serde(default)]
    network_mode: String,
    #[serde(default)]
    package_type: String,
    #[serde(default)]
    install_mode: String,
    installed_at_time: Option<u64>,
    #[serde(default)]
    incompatibilities: Vec<String>,
    #[serde(default)]
    optional_dependencies: Vec<String>,
    icon: Option<String>,
}

#[tauri::command]
fn list_profiles() -> Result<Vec<String>, String> {
    let base_path = std::env::var("HOME")
        .map_err(|e| e.to_string())?
        + "/.config/r2modmanPlus-local/Valheim/profiles";

    let entries = std::fs::read_dir(&base_path).map_err(|e| e.to_string())?;
    let mut names = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if meta.is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                let mods_path = format!("{}/{}/mods.yml", base_path, name);
                if std::path::Path::new(&mods_path).exists() {
                    names.push(name.to_string());
                }
            }
        }
    }

    names.sort();
    Ok(names)
}

#[tauri::command]
fn get_profile_mods(profile: String) -> Result<Vec<ModEntry>, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let path = format!(
        "{}/.config/r2modmanPlus-local/Valheim/profiles/{}/mods.yml",
        home, profile
    );
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mods: Vec<ModEntry> = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
    Ok(mods)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_profiles, get_profile_mods])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

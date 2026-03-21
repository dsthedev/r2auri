use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use base64::Engine;

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

fn parse_author_package_from_url(url: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = url.split('/').collect();
    let p_idx = parts.iter().position(|p| *p == "p")?;
    let author = parts.get(p_idx + 1)?.trim();
    let package = parts.get(p_idx + 2)?.trim();
    if author.is_empty() || package.is_empty() {
        return None;
    }
    Some((author.to_string(), package.to_string()))
}

fn package_folder_candidates(mod_entry: &ModEntry) -> Vec<String> {
    let mut out = Vec::<String>::new();

    if !mod_entry.name.trim().is_empty() {
        out.push(mod_entry.name.clone());
    }

    if let Some((author, package)) = parse_author_package_from_url(&mod_entry.website_url) {
        out.push(format!("{}-{}", author, package));
    }

    let normalized_display = mod_entry.display_name.trim().replace(' ', "_");
    if !mod_entry.author_name.trim().is_empty() && !normalized_display.is_empty() {
        out.push(format!("{}-{}", mod_entry.author_name.trim(), normalized_display));
    }

    out.sort();
    out.dedup();
    out
}

fn icon_data_url_from_file(path: &Path) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Some(format!("data:{};base64,{}", mime, encoded))
}

fn resolve_profile_icon(home: &str, profile: &str, mod_entry: &ModEntry) -> Option<String> {
    let plugins_root = PathBuf::from(format!(
        "{}/.config/r2modmanPlus-local/Valheim/profiles/{}/BepInEx/plugins",
        home, profile
    ));

    for folder in package_folder_candidates(mod_entry) {
        for ext in ["png", "jpg", "jpeg", "webp", "gif"] {
            let icon_path = plugins_root.join(&folder).join(format!("icon.{}", ext));
            if icon_path.exists() {
                if let Some(url) = icon_data_url_from_file(&icon_path) {
                    return Some(url);
                }
            }
        }
    }

    None
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
    let mut mods: Vec<ModEntry> = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    for mod_entry in &mut mods {
        let has_icon = mod_entry
            .icon
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        if !has_icon {
            mod_entry.icon = resolve_profile_icon(&home, &profile, mod_entry);
        }
    }

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

use std::path::{Path, PathBuf};

use crate::models::{FeatureConfigStatus, ProfileFeatureAvailability};
use crate::utils::find_first_file_case_insensitive;

pub fn detect_profile_feature_configs(base_path: &Path, profile: &str) -> Result<ProfileFeatureAvailability, String> {
    let profile_path = base_path.join(profile);
    if !profile_path.exists() || !profile_path.is_dir() {
        return Err(format!("Profile does not exist: {}", profile));
    }

    let config_root = profile_path.join("BepInEx").join("config");

    let level_settings_path = find_level_settings_path(&config_root);
    let wacky_spawners_path = find_wacky_spawners_path(&config_root);

    Ok(ProfileFeatureAvailability {
        profile: profile.to_string(),
        level_settings: FeatureConfigStatus {
            key: "level-settings".to_string(),
            found: level_settings_path.is_some(),
            file_path: level_settings_path,
        },
        wacky_spawners: FeatureConfigStatus {
            key: "wacky-spawners".to_string(),
            found: wacky_spawners_path.is_some(),
            file_path: wacky_spawners_path,
        },
    })
}

fn find_level_settings_path(config_root: &Path) -> Option<String> {
    if !config_root.exists() || !config_root.is_dir() {
        return None;
    }

    let sls_dir = find_first_directory_case_insensitive(config_root, "StarLevelSystem")?;
    let file = find_first_file_case_insensitive(&sls_dir, &["LevelSettings.yaml", "LevelSettings.yml"])?;
    Some(path_to_string(&file))
}

fn find_wacky_spawners_path(config_root: &Path) -> Option<String> {
    if !config_root.exists() || !config_root.is_dir() {
        return None;
    }

    let file = find_first_file_case_insensitive(
        config_root,
        &[
            "WackyMole.CustomSpawners.yml",
            "WackyMole.CustomSpawners.yaml",
        ],
    )?;

    Some(path_to_string(&file))
}

fn find_first_directory_case_insensitive(dir: &Path, target_name: &str) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let target = target_name.to_ascii_lowercase();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let file_name = path.file_name()?.to_str()?.to_ascii_lowercase();
        if file_name == target {
            return Some(path);
        }
    }

    None
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}
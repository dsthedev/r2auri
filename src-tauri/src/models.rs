use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VersionNumber {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModEntry {
    #[serde(default)]
    pub manifest_version: u32,
    pub name: String,
    pub author_name: String,
    pub display_name: String,
    pub description: String,
    pub website_url: String,
    pub version_number: VersionNumber,
    pub enabled: bool,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub network_mode: String,
    #[serde(default)]
    pub package_type: String,
    #[serde(default)]
    pub install_mode: String,
    pub installed_at_time: Option<u64>,
    #[serde(default)]
    pub incompatibilities: Vec<String>,
    #[serde(default)]
    pub optional_dependencies: Vec<String>,
    pub icon: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppSettings {
    pub valheim_mods_path: String,
    #[serde(default)]
    pub default_profile: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LevelSpreadEntry {
    pub level: u32,
    pub value: f64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LevelSettingsDocument {
    pub file_path: String,
    pub algorithm_comment: Option<String>,
    pub entries: Vec<LevelSpreadEntry>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpawnerConfigDocument {
    pub file_path: String,
    pub spawners: Vec<JsonValue>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileLogLine {
    pub line_number: usize,
    pub raw: String,
    pub level: String,
    pub source: String,
    pub message: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileLogSnapshot {
    pub path: String,
    pub total_lines: usize,
    pub lines: Vec<ProfileLogLine>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TailSessionStart {
    pub session_id: String,
    pub shell: String,
    pub command: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TailChunk {
    pub lines: Vec<String>,
    pub running: bool,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LinkedConfigFile {
    pub file_name: String,
    pub file_path: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModConfigGroup {
    pub mod_name: String,
    pub author_name: String,
    pub display_name: String,
    pub config_files: Vec<LinkedConfigFile>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileConfigIndex {
    pub profile: String,
    pub mods: Vec<ModConfigGroup>,
    pub unlinked: Vec<LinkedConfigFile>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FeatureConfigStatus {
    pub key: String,
    pub found: bool,
    pub file_path: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFeatureAvailability {
    pub profile: String,
    pub level_settings: FeatureConfigStatus,
    pub wacky_spawners: FeatureConfigStatus,
}

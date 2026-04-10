use serde::{Deserialize, Serialize};

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

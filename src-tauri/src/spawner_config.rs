use std::path::Path;

use serde_json::{Map as JsonMap, Value as JsonValue};
use serde_yaml::Value as YamlValue;

use crate::models::SpawnerConfigDocument;

pub fn read_spawner_config(config_path: &Path) -> Result<SpawnerConfigDocument, String> {
    let content = std::fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let spawners = parse_spawner_entries(&content)?;

    Ok(SpawnerConfigDocument {
        file_path: config_path.to_string_lossy().to_string(),
        spawners,
    })
}

pub fn save_spawner_config(config_path: &Path, spawners: &[JsonValue]) -> Result<(), String> {
    let content = serialize_spawner_config(spawners)?;
    std::fs::write(config_path, content).map_err(|e| e.to_string())
}

pub fn render_spawner_config(spawners: &[JsonValue]) -> Result<String, String> {
    serialize_spawner_config(spawners)
}

fn parse_spawner_entries(content: &str) -> Result<Vec<JsonValue>, String> {
    let yaml_value: YamlValue = serde_yaml::from_str(content).map_err(|e| e.to_string())?;
    let json_value = serde_json::to_value(yaml_value).map_err(|e| e.to_string())?;

    if let Some(array) = json_value.as_array() {
        return Ok(array.clone());
    }

    if let Some(array) = json_value.get("spawners").and_then(|value| value.as_array()) {
        return Ok(array.clone());
    }

    Ok(Vec::new())
}

fn serialize_spawner_config(spawners: &[JsonValue]) -> Result<String, String> {
    let mut root = JsonMap::new();
    root.insert("spawners".to_string(), JsonValue::Array(spawners.to_vec()));
    serde_yaml::to_string(&JsonValue::Object(root)).map_err(|e| e.to_string())
}
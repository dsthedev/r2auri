// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn list_profiles() -> Result<Vec<String>, String> {
    let path = std::env::var("HOME")
        .map_err(|e| e.to_string())?
        + "/.config/r2modmanPlus-local/Valheim/profiles";

    let entries = std::fs::read_dir(path)
        .map_err(|e| e.to_string())?;

    let mut names = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }

    Ok(names)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet,list_profiles])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

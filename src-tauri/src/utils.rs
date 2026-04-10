use std::path::{Path, PathBuf};

pub fn parse_author_package_from_url(url: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = url.split('/').collect();
    let p_idx = parts.iter().position(|p| *p == "p")?;
    let author = parts.get(p_idx + 1)?.trim();
    let package = parts.get(p_idx + 2)?.trim();
    if author.is_empty() || package.is_empty() {
        return None;
    }
    Some((author.to_string(), package.to_string()))
}

pub fn find_first_file_case_insensitive(dir: &Path, names: &[&str]) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = path.file_name()?.to_str()?.to_ascii_lowercase();
        for name in names {
            if file_name == name.to_ascii_lowercase() {
                return Some(path);
            }
        }
    }
    None
}

pub fn get_default_valheim_mods_path() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let path = format!(
        "{}/.config/r2modmanPlus-local/Valheim/profiles",
        home
    );
    if Path::new(&path).exists() {
        Some(path)
    } else {
        None
    }
}

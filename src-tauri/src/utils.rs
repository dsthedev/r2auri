use std::path::{Path, PathBuf};
use std::process::Command;

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

pub fn reveal_path_in_file_manager(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .status()
            .map_err(|e| e.to_string())?;

        if status.success() {
            return Ok(());
        }

        return Err("Failed to open Windows Explorer".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg("-R")
            .arg(path)
            .status()
            .map_err(|e| e.to_string())?;

        if status.success() {
            return Ok(());
        }

        return Err("Failed to reveal path in Finder".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let open_target = if path.is_dir() {
            path.to_path_buf()
        } else {
            path.parent()
                .map(|parent| parent.to_path_buf())
                .unwrap_or_else(|| path.to_path_buf())
        };

        let status = Command::new("xdg-open")
            .arg(open_target)
            .status()
            .map_err(|e| e.to_string())?;

        if status.success() {
            return Ok(());
        }

        return Err("Failed to open directory in file manager".to_string());
    }

    #[allow(unreachable_code)]
    Err("Unsupported operating system".to_string())
}

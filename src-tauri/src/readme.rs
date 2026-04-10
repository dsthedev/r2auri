use std::path::{Path, PathBuf};
use crate::models::ModEntry;
use crate::utils::find_first_file_case_insensitive;

fn package_folder_candidates(mod_entry: &ModEntry) -> Vec<String> {
    let mut out = Vec::<String>::new();

    if !mod_entry.name.trim().is_empty() {
        out.push(mod_entry.name.clone());
    }

    if let Some((author, package)) = crate::utils::parse_author_package_from_url(&mod_entry.website_url) {
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

pub fn read_app_readme() -> Result<String, String> {
    let app_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| "Unable to resolve app root path".to_string())?
        .to_path_buf();
    let readme_path = app_root.join("README.md");
    std::fs::read_to_string(readme_path).map_err(|e| e.to_string())
}

pub fn read_mod_readme(
    plugins_root: &Path,
    mod_entry: &ModEntry,
) -> Result<String, String> {
    for folder in package_folder_candidates(mod_entry) {
        let package_dir = plugins_root.join(folder);
        if !package_dir.exists() || !package_dir.is_dir() {
            continue;
        }

        if let Some(readme_path) = find_first_file_case_insensitive(
            &package_dir,
            &["README.md", "README.txt", "README"],
        ) {
            return std::fs::read_to_string(readme_path).map_err(|e| e.to_string());
        }

        if let Some(changelog_path) =
            find_first_file_case_insensitive(&package_dir, &["CHANGELOG.md", "CHANGELOG"])
        {
            return std::fs::read_to_string(changelog_path).map_err(|e| e.to_string());
        }
    }

    Err(format!(
        "README not found for mod in profile"
    ))
}

use std::path::Path;
use crate::models::ModEntry;
use base64::Engine;

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

pub fn resolve_profile_icon(plugins_root: &Path, mod_entry: &ModEntry) -> Option<String> {
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

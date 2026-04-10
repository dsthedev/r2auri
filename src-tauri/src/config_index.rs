use std::collections::HashSet;
use std::path::Path;

use crate::models::{LinkedConfigFile, ModConfigGroup, ModEntry, ProfileConfigIndex};

#[derive(Debug, Clone)]
struct ModMatcher {
    mod_name: String,
    author_name: String,
    display_name: String,
    package_token: String,
    author_token: String,
    display_token: String,
    mod_name_token: String,
    primary_tokens: Vec<String>,
    author_package_tokens: Vec<String>,
    aliases: Vec<String>,
}

#[derive(Debug, Clone)]
struct FileDescriptor {
    linked: LinkedConfigFile,
    token: String,
}

pub fn build_profile_config_index(base_path: &Path, profile: &str) -> Result<ProfileConfigIndex, String> {
    let profile_path = base_path.join(profile);
    let mods_path = profile_path.join("mods.yml");
    let config_path = profile_path.join("BepInEx").join("config");

    let content = std::fs::read_to_string(&mods_path).map_err(|e| e.to_string())?;
    let mods: Vec<ModEntry> = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let active_mods: Vec<ModEntry> = mods.into_iter().filter(|m| m.enabled).collect();
    let matchers: Vec<ModMatcher> = active_mods.iter().map(build_matcher).collect();

    let mut groups: Vec<ModConfigGroup> = matchers
        .iter()
        .map(|matcher| ModConfigGroup {
            mod_name: matcher.mod_name.clone(),
            author_name: matcher.author_name.clone(),
            display_name: matcher.display_name.clone(),
            config_files: Vec::new(),
        })
        .collect();

    if !config_path.exists() || !config_path.is_dir() {
        return Ok(ProfileConfigIndex {
            profile: profile.to_string(),
            mods: groups,
            unlinked: Vec::new(),
        });
    }

    let mut unlinked = Vec::new();
    let mut files = list_config_files(&config_path)?;
    files.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    let files: Vec<FileDescriptor> = files
        .into_iter()
        .map(|linked| {
            let token = normalize_text(strip_extension(&linked.file_name));
            FileDescriptor { linked, token }
        })
        .collect();

    for file in files {
        if let Some(idx) = select_match_index(&matchers, &file.token) {
            groups[idx].config_files.push(file.linked);
        } else {
            unlinked.push(file.linked);
        }
    }

    for group in &mut groups {
        group
            .config_files
            .sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    }

    groups.sort_by(|a, b| {
        b.config_files
            .len()
            .cmp(&a.config_files.len())
            .then(a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()))
    });

    Ok(ProfileConfigIndex {
        profile: profile.to_string(),
        mods: groups,
        unlinked,
    })
}

fn list_config_files(config_path: &Path) -> Result<Vec<LinkedConfigFile>, String> {
    let mut results = Vec::new();
    let entries = std::fs::read_dir(config_path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if !meta.is_file() {
            continue;
        }

        let path = entry.path();
        let file_name = match path.file_name().and_then(|f| f.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        results.push(LinkedConfigFile {
            file_name,
            file_path: path_to_string(&path)?,
        });
    }

    Ok(results)
}

fn build_matcher(mod_entry: &ModEntry) -> ModMatcher {
    let mut split = mod_entry.name.splitn(2, '-');
    let author_raw = split.next().unwrap_or_default();
    let package_raw = split.next().unwrap_or(mod_entry.name.as_str());

    let package_token = normalize_text(package_raw);
    let author_token = normalize_text(author_raw);
    let display_token = normalize_text(&mod_entry.display_name);
    let mod_name_token = normalize_text(&mod_entry.name);

    let mut aliases = HashSet::new();
    aliases.insert(package_token.clone());
    aliases.insert(display_token.clone());
    aliases.insert(mod_name_token.clone());

    let mut primary_tokens = Vec::new();
    if !package_token.is_empty() {
        primary_tokens.push(package_token.clone());
    }
    if !display_token.is_empty() && !primary_tokens.contains(&display_token) {
        primary_tokens.push(display_token.clone());
    }
    if !mod_name_token.is_empty() && !primary_tokens.contains(&mod_name_token) {
        primary_tokens.push(mod_name_token.clone());
    }

    let mut author_package_tokens = Vec::new();
    if !author_token.is_empty() && !package_token.is_empty() {
        author_package_tokens.push(format!("{}{}", author_token, package_token));
    }
    if !author_token.is_empty() && !display_token.is_empty() {
        author_package_tokens.push(format!("{}{}", author_token, display_token));
    }

    for token in normalized_words(package_raw) {
        if token.len() >= 4 {
            aliases.insert(token);
        }
    }

    for token in normalized_words(&mod_entry.display_name) {
        if token.len() >= 4 {
            aliases.insert(token);
        }
    }

    if let Some((url_author, url_package)) = parse_author_package_from_url(&mod_entry.website_url) {
        let url_author_token = normalize_text(&url_author);
        if !url_author_token.is_empty() {
            aliases.insert(url_author_token);
        }

        let url_package_token = normalize_text(&url_package);
        if !url_package_token.is_empty() {
            aliases.insert(url_package_token.clone());
            if !primary_tokens.contains(&url_package_token) {
                primary_tokens.push(url_package_token.clone());
            }
            if !author_token.is_empty() {
                author_package_tokens.push(format!("{}{}", author_token, url_package_token));
            }
        }

        for token in normalized_words(&url_package) {
            if token.len() >= 4 {
                aliases.insert(token);
            }
        }
    }

    ModMatcher {
        mod_name: mod_entry.name.clone(),
        author_name: mod_entry.author_name.clone(),
        display_name: mod_entry.display_name.clone(),
        package_token,
        author_token,
        display_token,
        mod_name_token,
        primary_tokens,
        author_package_tokens,
        aliases: aliases.into_iter().collect(),
    }
}

fn select_match_index(matchers: &[ModMatcher], file_token: &str) -> Option<usize> {
    if let Some(idx) = find_unique_best(matchers, file_token, score_pass_exact_primary) {
        return Some(idx);
    }

    if let Some(idx) = find_unique_best(matchers, file_token, score_pass_exact_author_package) {
        return Some(idx);
    }

    if let Some(idx) = find_unique_best(matchers, file_token, score_pass_strong_contains) {
        return Some(idx);
    }

    find_unique_best(matchers, file_token, score_pass_fallback_aliases)
}

fn find_unique_best(
    matchers: &[ModMatcher],
    file_token: &str,
    scorer: fn(&ModMatcher, &str) -> usize,
) -> Option<usize> {
    let mut best_score = 0;
    let mut best_index = None;
    let mut tie = false;

    for (idx, matcher) in matchers.iter().enumerate() {
        let score = scorer(matcher, file_token);
        if score > best_score {
            best_score = score;
            best_index = Some(idx);
            tie = false;
        } else if score > 0 && score == best_score {
            tie = true;
        }
    }

    if best_score == 0 || tie {
        return None;
    }

    best_index
}

fn score_pass_exact_primary(matcher: &ModMatcher, file_token: &str) -> usize {
    let mut score = 0;

    for token in &matcher.primary_tokens {
        if token.is_empty() {
            continue;
        }
        if file_token == token {
            score = score.max(1000);
        }
    }

    score
}

fn score_pass_exact_author_package(matcher: &ModMatcher, file_token: &str) -> usize {
    let mut score = 0;

    for token in &matcher.author_package_tokens {
        if token.is_empty() {
            continue;
        }
        if file_token == token {
            score = score.max(900);
        }
    }

    score
}

fn score_pass_strong_contains(matcher: &ModMatcher, file_token: &str) -> usize {
    let mut score = 0;

    for token in &matcher.primary_tokens {
        if token.len() < 4 {
            continue;
        }

        if file_token.contains(token) {
            score = score.max(600);
            if file_token.starts_with(token) || file_token.ends_with(token) {
                score = score.max(700);
            }
        }
    }

    if !matcher.author_token.is_empty() && file_token.contains(&matcher.author_token) {
        score += 40;
    }

    score
}

fn score_pass_fallback_aliases(matcher: &ModMatcher, file_token: &str) -> usize {
    let mut score = 0;

    for alias in &matcher.aliases {
        if alias.len() < 4 {
            continue;
        }

        if file_token == alias {
            score = score.max(500);
        } else if file_token.contains(alias) {
            score = score.max(220);
        }
    }

    if !matcher.package_token.is_empty()
        && matcher.package_token == matcher.mod_name_token
        && file_token.contains(&matcher.package_token)
    {
        score += 25;
    }

    if !matcher.author_token.is_empty() && file_token.contains(&matcher.author_token) {
        score += 20;
    }

    if !matcher.display_token.is_empty() && file_token.contains(&matcher.display_token) {
        score += 40;
    }

    score
}

fn normalized_words(raw: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();

    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() {
            current.push(ch);
        } else if !current.is_empty() {
            words.push(current.clone());
            current.clear();
        }
    }

    if !current.is_empty() {
        words.push(current);
    }

    words
        .into_iter()
        .map(|w| normalize_text(&w))
        .filter(|w| !w.is_empty())
        .collect()
}

fn normalize_text(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

fn strip_extension(file_name: &str) -> &str {
    match file_name.rsplit_once('.') {
        Some((stem, _)) => stem,
        None => file_name,
    }
}

fn parse_author_package_from_url(url: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = url.split('/').collect();
    let package_index = parts
        .iter()
        .position(|segment| *segment == "p" || *segment == "package")?;

    let author = parts.get(package_index + 1)?.trim();
    let package = parts.get(package_index + 2)?.trim();

    if author.is_empty() || package.is_empty() {
        return None;
    }

    Some((author.to_string(), package.to_string()))
}

fn path_to_string(path: &Path) -> Result<String, String> {
    path.canonicalize()
        .map_err(|e| e.to_string())?
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Could not convert path to utf-8".to_string())
}

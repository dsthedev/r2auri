use std::path::Path;

use crate::models::{LevelSettingsDocument, LevelSpreadEntry};

pub fn read_level_settings(config_path: &Path) -> Result<LevelSettingsDocument, String> {
    let content = std::fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let parsed = parse_level_settings_document(&content)?;

    Ok(LevelSettingsDocument {
        file_path: config_path.to_string_lossy().to_string(),
        algorithm_comment: parsed.algorithm_comment,
        entries: parsed.entries,
    })
}

pub fn save_level_settings_with_algorithm(
    config_path: &Path,
    entries: &[LevelSpreadEntry],
    algorithm_comment: Option<&str>,
) -> Result<(), String> {
    let content = std::fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let parsed = parse_level_settings_document(&content)?;
    let next_content = rewrite_level_settings_document(&content, &parsed, entries, algorithm_comment);
    std::fs::write(config_path, next_content).map_err(|e| e.to_string())
}

struct ParsedLevelSection {
    start_index: usize,
    end_index: usize,
    entry_indent: usize,
    leading_comments: Vec<String>,
    algorithm_comment: Option<String>,
    entries: Vec<LevelSpreadEntry>,
}

fn parse_level_settings_document(content: &str) -> Result<ParsedLevelSection, String> {
    let lines: Vec<&str> = content.lines().collect();
    let start_index = lines
        .iter()
        .position(|line| line.trim_start() == "defaultCreatureLevelUpChance:")
        .ok_or_else(|| "Could not find defaultCreatureLevelUpChance section".to_string())?;

    let header_indent = leading_whitespace(lines[start_index]);
    let mut end_index = lines.len();
    let mut entries = Vec::new();
    let mut leading_comments = Vec::new();
    let mut algorithm_comment = None;
    let mut entry_indent = header_indent + 2;
    let mut saw_entry = false;

    for (index, line) in lines.iter().enumerate().skip(start_index + 1) {
        let trimmed = line.trim();
        let indent = leading_whitespace(line);

        if !trimmed.is_empty() && indent <= header_indent {
            end_index = index;
            break;
        }

        if trimmed.is_empty() {
            if !saw_entry {
                leading_comments.push((*line).to_string());
            }
            continue;
        }

        if trimmed.starts_with('#') {
            if !saw_entry {
                if let Some(label) = parse_algorithm_comment(trimmed) {
                    algorithm_comment = Some(label);
                }
                leading_comments.push((*line).to_string());
            }
            continue;
        }

        if let Some((level, value)) = parse_level_entry(trimmed) {
            if !saw_entry {
                entry_indent = indent;
            }
            saw_entry = true;
            entries.push(LevelSpreadEntry { level, value });
        }
    }

    if entries.is_empty() {
        return Err("defaultCreatureLevelUpChance section did not contain any level entries".to_string());
    }

    Ok(ParsedLevelSection {
        start_index,
        end_index,
        entry_indent,
        leading_comments,
        algorithm_comment,
        entries,
    })
}

fn rewrite_level_settings_document(
    content: &str,
    parsed: &ParsedLevelSection,
    entries: &[LevelSpreadEntry],
    algorithm_comment: Option<&str>,
) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let mut next_lines: Vec<String> = Vec::new();

    for line in &lines[..=parsed.start_index] {
        next_lines.push((*line).to_string());
    }

    let algorithm_line = algorithm_comment
        .map(|label| format!("{}# alogorithm: {}", " ".repeat(parsed.entry_indent), label.trim()));

    let mut algorithm_line_written = false;
    for comment_line in &parsed.leading_comments {
        let trimmed = comment_line.trim();
        if parse_algorithm_comment(trimmed).is_some() {
            if let Some(line) = algorithm_line.as_ref() {
                next_lines.push(line.clone());
                algorithm_line_written = true;
            }
            continue;
        }

        next_lines.push(comment_line.clone());
    }

    if !algorithm_line_written {
      if let Some(line) = algorithm_line {
          next_lines.push(line);
      }
    }

    let indent = " ".repeat(parsed.entry_indent);
    let mut sorted_entries = entries.to_vec();
    sorted_entries.sort_by_key(|entry| entry.level);

    for entry in sorted_entries {
        next_lines.push(format!("{}{}: {:.4}", indent, entry.level, entry.value));
    }

    for line in &lines[parsed.end_index..] {
        next_lines.push((*line).to_string());
    }

    let mut output = next_lines.join("\n");
    if content.ends_with('\n') {
        output.push('\n');
    }
    output
}

fn parse_level_entry(line: &str) -> Option<(u32, f64)> {
    let (level_raw, value_raw) = line.split_once(':')?;
    let level = level_raw.trim().parse::<u32>().ok()?;
    let value = value_raw.trim().parse::<f64>().ok()?;
    Some((level, value))
}

fn leading_whitespace(line: &str) -> usize {
    line.len().saturating_sub(line.trim_start().len())
}

fn parse_algorithm_comment(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if !trimmed.starts_with('#') {
        return None;
    }

    let body = trimmed.trim_start_matches('#').trim();
    let (key, value) = body.split_once(':')?;
    let normalized_key = key.trim().to_ascii_lowercase();
    if normalized_key == "alogorithm" || normalized_key == "algorithm" {
        return Some(value.trim().to_string());
    }

    None
}
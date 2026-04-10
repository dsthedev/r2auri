use std::collections::{HashMap, VecDeque};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::models::{ProfileLogLine, ProfileLogSnapshot, TailChunk, TailSessionStart};

const DEFAULT_TAIL_LINES: usize = 200;
const MAX_TAIL_BUFFER_LINES: usize = 800;

static NEXT_TAIL_SESSION_ID: AtomicU64 = AtomicU64::new(1);

pub struct TailSessionRegistry {
    sessions: Mutex<HashMap<String, TailSession>>,
}

struct TailSession {
    process: Arc<Mutex<Child>>,
    buffer: Arc<Mutex<VecDeque<String>>>,
    running: Arc<AtomicBool>,
}

struct TailProcessSpec {
    program: String,
    args: Vec<String>,
    shell: String,
    command: String,
}

impl Default for TailSessionRegistry {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

/// Pre-filter stage: Remove empty lines and other noise from raw log data
fn should_include_line(raw_line: &str) -> bool {
    !raw_line.trim().is_empty()
}

/// Get a paginated chunk of log lines. Loads from the END of the file (most recent first).
/// offset=0 gets the most recent lines, offset=500 skips the first 500 recent lines, etc.
pub fn get_profile_log_snapshot(base_path: &Path, profile: &str) -> Result<ProfileLogSnapshot, String> {
    get_profile_log_snapshot_paginated(base_path, profile, 0, 500)
}

/// Get a paginated chunk of log lines.
/// offset: number of recent lines to skip (0 = most recent)
/// limit: number of lines to return (default 500 for performance)
pub fn get_profile_log_snapshot_paginated(
    base_path: &Path,
    profile: &str,
    offset: usize,
    limit: usize,
) -> Result<ProfileLogSnapshot, String> {
    let log_path = resolve_profile_log_path(base_path, profile)?;
    let file = File::open(&log_path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);

    // First pass: count total lines and collect them in reverse (with pre-filtering applied)
    let mut all_lines: Vec<String> = Vec::new();
    for line in reader.lines() {
        let raw = line.map_err(|e| e.to_string())?;
        if should_include_line(&raw) {
            all_lines.push(raw);
        }
    }

    let total_lines = all_lines.len();
    
    // Reverse to get most recent lines first
    all_lines.reverse();
    
    let start = offset.min(all_lines.len());
    let end = (start + limit).min(all_lines.len());
    let chunk = &all_lines[start..end];

    // Parse only the chunk we need
    let mut lines = Vec::new();
    for (i, raw_line) in chunk.iter().enumerate() {
        // Adjust line number: account for offset and reversal
        let actual_line_number = total_lines - (offset + i);
        lines.push(parse_log_line(actual_line_number, raw_line));
    }

    Ok(ProfileLogSnapshot {
        path: log_path.to_string_lossy().to_string(),
        total_lines,
        lines,
    })
}

pub fn start_tail_session(
    base_path: &Path,
    profile: &str,
    registry: &TailSessionRegistry,
) -> Result<TailSessionStart, String> {
    let log_path = resolve_profile_log_path(base_path, profile)?;
    let spec = build_tail_process_spec(&log_path)?;

    let mut child = Command::new(&spec.program)
        .args(&spec.args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start log tail process: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture tail stdout".to_string())?;

    let process = Arc::new(Mutex::new(child));
    let buffer = Arc::new(Mutex::new(VecDeque::new()));
    let running = Arc::new(AtomicBool::new(true));

    let buffer_for_thread = Arc::clone(&buffer);
    let running_for_thread = Arc::clone(&running);

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let Ok(line) = line else {
                break;
            };

            let mut guard = match buffer_for_thread.lock() {
                Ok(guard) => guard,
                Err(_) => break,
            };

            if guard.len() >= MAX_TAIL_BUFFER_LINES {
                guard.pop_front();
            }
            guard.push_back(line);
        }

        running_for_thread.store(false, Ordering::Relaxed);
    });

    let session_id = format!(
        "tail-session-{}",
        NEXT_TAIL_SESSION_ID.fetch_add(1, Ordering::Relaxed)
    );

    let mut sessions = registry
        .sessions
        .lock()
        .map_err(|_| "Tail session registry is unavailable".to_string())?;

    sessions.insert(
        session_id.clone(),
        TailSession {
            process,
            buffer,
            running,
        },
    );

    Ok(TailSessionStart {
        session_id,
        shell: spec.shell,
        command: spec.command,
    })
}

pub fn read_tail_chunk(session_id: &str, registry: &TailSessionRegistry) -> Result<TailChunk, String> {
    let (buffer, running) = {
        let sessions = registry
            .sessions
            .lock()
            .map_err(|_| "Tail session registry is unavailable".to_string())?;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Unknown tail session: {session_id}"))?;

        (Arc::clone(&session.buffer), Arc::clone(&session.running))
    };

    let mut lines = Vec::new();
    let mut buffer = buffer
        .lock()
        .map_err(|_| "Tail session buffer is unavailable".to_string())?;

    while let Some(line) = buffer.pop_front() {
        lines.push(line);
    }

    Ok(TailChunk {
        lines,
        running: running.load(Ordering::Relaxed),
    })
}

pub fn stop_tail_session(session_id: &str, registry: &TailSessionRegistry) -> Result<(), String> {
    let session = {
        let mut sessions = registry
            .sessions
            .lock()
            .map_err(|_| "Tail session registry is unavailable".to_string())?;

        sessions.remove(session_id)
    };

    if let Some(session) = session {
        session.running.store(false, Ordering::Relaxed);

        if let Ok(mut child) = session.process.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    Ok(())
}

fn resolve_profile_log_path(base_path: &Path, profile: &str) -> Result<PathBuf, String> {
    let log_path = base_path.join(profile).join("BepInEx/LogOutput.log");
    if !log_path.exists() || !log_path.is_file() {
        return Err(format!("Log file not found: {}", log_path.to_string_lossy()));
    }

    Ok(log_path)
}

fn parse_log_line(line_number: usize, raw_line: &str) -> ProfileLogLine {
    let raw = raw_line.trim_end_matches('\r').to_string();
    let (level, source, message) = parse_log_parts(&raw);

    ProfileLogLine {
        line_number,
        raw,
        level,
        source,
        message,
    }
}

fn parse_log_parts(raw: &str) -> (String, String, String) {
    let Some(remainder) = raw.strip_prefix('[') else {
        return (String::new(), String::new(), raw.to_string());
    };

    let Some(bracket_end) = remainder.find(']') else {
        return (String::new(), String::new(), raw.to_string());
    };

    let header = remainder[..bracket_end].trim();
    let message = remainder[bracket_end + 1..].trim_start().to_string();

    let mut parts = header.splitn(2, ':');
    let level = parts.next().unwrap_or_default().trim().to_string();
    let source = parts.next().unwrap_or_default().trim().to_string();

    (level, source, message)
}

fn build_tail_process_spec(log_path: &Path) -> Result<TailProcessSpec, String> {
    #[cfg(target_os = "windows")]
    {
        let path = log_path.to_string_lossy().replace('"', "`\"");
        let command = format!("Get-Content -Path \"{path}\" -Tail {DEFAULT_TAIL_LINES} -Wait");

        return Ok(TailProcessSpec {
            program: "powershell".to_string(),
            args: vec!["-NoProfile".to_string(), "-Command".to_string(), command.clone()],
            shell: "powershell".to_string(),
            command,
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        let escaped_path = shell_quote(log_path.to_string_lossy().as_ref());
        let command = format!("tail -n {DEFAULT_TAIL_LINES} -f {escaped_path} 2>&1");

        Ok(TailProcessSpec {
            program: shell.clone(),
            args: vec!["-lc".to_string(), command.clone()],
            shell,
            command,
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}
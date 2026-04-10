export interface ProfileLogLine {
  lineNumber: number;
  raw: string;
  level: string;
  source: string;
  message: string;
}

export interface ProfileLogSnapshot {
  path: string;
  totalLines: number;
  lines: ProfileLogLine[];
}

export interface TailSessionStart {
  sessionId: string;
  shell: string;
  command: string;
}

export interface TailChunk {
  lines: string[];
  running: boolean;
}
export interface VersionNumber {
  major: number;
  minor: number;
  patch: number;
}

export interface ModEntry {
  manifestVersion?: number;
  name: string;
  authorName: string;
  displayName: string;
  description: string;
  websiteUrl: string;
  versionNumber: VersionNumber;
  enabled: boolean;
  dependencies: string[];
  incompatibilities?: string[];
  optionalDependencies?: string[];
  networkMode: string;
  packageType: string;
  installMode?: string;
  installedAtTime: number | null;
  icon: string | null;
}

export type FilterMode = "all" | "enabled" | "disabled";
export type SortMode = "name" | "author" | "version";

export const versionStr = (v: VersionNumber) => `${v.major}.${v.minor}.${v.patch}`;

export interface DependencyRef {
  packageName: string;
  requiredVersion: string | null;
}

export function parseDependencyRef(dep: string): DependencyRef {
  const trimmed = dep.trim();
  const match = trimmed.match(/^(.*)-(\d+\.\d+\.\d+)$/);
  if (!match) {
    return { packageName: trimmed, requiredVersion: null };
  }
  return { packageName: match[1], requiredVersion: match[2] };
}

export function compareVersionStrings(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function evaluateVersionRule(currentVersion: string, expr: string): boolean {
  const trimmed = expr.trim();
  const opMatch = trimmed.match(/^(<=|>=|=|<|>)(\d+\.\d+\.\d+)$/);
  if (!opMatch) return currentVersion === trimmed;
  const [, op, version] = opMatch;
  const cmp = compareVersionStrings(currentVersion, version);
  if (op === "<") return cmp < 0;
  if (op === ">") return cmp > 0;
  if (op === "<=") return cmp <= 0;
  if (op === ">=") return cmp >= 0;
  return cmp === 0;
}

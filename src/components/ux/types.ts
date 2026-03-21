export interface VersionNumber {
  major: number;
  minor: number;
  patch: number;
}

export interface ModEntry {
  name: string;
  authorName: string;
  displayName: string;
  description: string;
  websiteUrl: string;
  versionNumber: VersionNumber;
  enabled: boolean;
  dependencies: string[];
  networkMode: string;
  packageType: string;
  installedAtTime: number | null;
  icon: string | null;
}

export type FilterMode = "all" | "enabled" | "disabled";
export type SortMode = "name" | "author" | "version";

export const versionStr = (v: VersionNumber) => `${v.major}.${v.minor}.${v.patch}`;

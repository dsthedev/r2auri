export interface LinkedConfigFile {
  fileName: string;
  filePath: string;
}

export interface ModConfigGroup {
  modName: string;
  authorName: string;
  displayName: string;
  configFiles: LinkedConfigFile[];
}

export interface ProfileConfigIndex {
  profile: string;
  mods: ModConfigGroup[];
  unlinked: LinkedConfigFile[];
}

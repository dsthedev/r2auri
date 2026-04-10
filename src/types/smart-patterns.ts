export type SmartPatternId =
  | "shader-compiler-spam"
  | "hookgen-reuse"
  | "plugin-loading"
  | "jotunn-init"
  | "unity-localization-flood"
  | "starlevel-localization-scan"
  | "save-data-dump";

export interface SmartPatternMetadata {
  id: SmartPatternId;
  title: string;
  description: string;
  minLinesToShow: number;
  enabled: boolean;
}

export interface SmartPatternConfig {
  patterns: SmartPatternMetadata[];
  version: number;
}

export const DEFAULT_SMART_PATTERNS: SmartPatternMetadata[] = [
  {
    id: "shader-compiler-spam",
    title: "Repeated Shader Error Spam",
    description: "Same Unity shader compiler error repeated enough times to drown out distinct failures.",
    minLinesToShow: 3,
    enabled: true,
  },
  {
    id: "hookgen-reuse",
    title: "HookGen Reuse Chatter",
    description: "HookGenPatcher noting that it already prepared patches. Useful context to know setup is efficient, but distracting noise in large logs.",
    minLinesToShow: 2,
    enabled: true,
  },
  {
    id: "plugin-loading",
    title: "Plugin Loading Spam",
    description: "BepInEx Loading logs become repetitive junk when there are dozens of mods.",
    minLinesToShow: 8,
    enabled: true,
  },
  {
    id: "jotunn-init",
    title: "Jotunn Initialization",
    description: "Jotunn mod framework registering things during startup. Helpful to know what's happening, but repetitive.",
    minLinesToShow: 5,
    enabled: true,
  },
  {
    id: "unity-localization-flood",
    title: "Unity Localization Spam",
    description: "Multiple mods loading localization files causes a flood of redundant log messages.",
    minLinesToShow: 5,
    enabled: true,
  },
  {
    id: "starlevel-localization-scan",
    title: "StarLevelSystem Localization Scan",
    description: "StarLevelSystem reading localization directory contents in bulk. Noise when debugging other issues.",
    minLinesToShow: 5,
    enabled: true,
  },
  {
    id: "save-data-dump",
    title: "Save Data Inventory Dump",
    description: "Large block of local/platform save file listings that overwhelm the log table.",
    minLinesToShow: 8,
    enabled: true,
  },
];

import { SmartPatternMetadata } from "./smart-patterns";

export interface AppSettings {
  valheim_mods_path: string;
  default_profile: string;
  custom_smart_patterns?: SmartPatternMetadata[];
}

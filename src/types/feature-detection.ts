export interface FeatureConfigStatus {
  key: string;
  found: boolean;
  filePath: string | null;
}

export interface ProfileFeatureAvailability {
  profile: string;
  levelSettings: FeatureConfigStatus;
  wackySpawners: FeatureConfigStatus;
}
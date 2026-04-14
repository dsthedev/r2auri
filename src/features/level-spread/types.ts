export type LevelEntry = {
  level: number;
  value: number;
};

export type LevelChanceEntry = LevelEntry & {
  effectiveChance: number;
};

export type AlgorithmControl =
  | "centerPosition"
  | "centerWeight"
  | "stepAmount"
  | "gaussianSpread"
  | "gaussianMidBoost";

export type DistributionAlgorithm =
  | "manual"
  | "exponential"
  | "gaussian"
  | "linear"
  | "evenish"
  | "fibonacci"
  | "geometric"
  | "powerLaw";
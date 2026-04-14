import type { AlgorithmControl, DistributionAlgorithm } from "@/features/level-spread/types";

export const DEFAULT_LEVEL_SPREAD = `1: 20
2: 10
3: 5
4: 2
5: 1
6: 0.5
7: 0.25
8: 0.125
9: 0.0625
10: 0.0312
11: 0.0156
12: 0.0078
13: 0.0039
14: 0.0019
15: 0.0015
16: 0.001
17: 0.0009
18: 0.0008
19: 0.0007
20: 0.0006
21: 0.0005
22: 0.0004
23: 0.0003
24: 0.0002
25: 0.0001`;

export const DECAY_FACTOR = 0.5;
export const DEFAULT_CENTER_WEIGHT = 100;
export const DEFAULT_MAX_LEVEL = 25;
export const DEFAULT_STEP_AMOUNT = 1;
export const DEFAULT_GAUSSIAN_SPREAD = 1;
export const DEFAULT_GAUSSIAN_MID_BOOST = 1;

export const distributionAlgorithms: Array<{
  value: DistributionAlgorithm;
  label: string;
  controls: AlgorithmControl[];
}> = [
  { value: "manual", label: "Manual (no algorithm)", controls: [] },
  {
    value: "exponential",
    label: "Exponential (original)",
    controls: ["centerPosition", "centerWeight"],
  },
  {
    value: "gaussian",
    label: "Gaussian",
    controls: [
      "centerPosition",
      "centerWeight",
      "gaussianSpread",
      "gaussianMidBoost",
    ],
  },
  {
    value: "linear",
    label: "Linear taper",
    controls: ["centerPosition", "centerWeight", "stepAmount"],
  },
  { value: "evenish", label: "Even-ish", controls: [] },
  { value: "fibonacci", label: "Fibonacci (from max level)", controls: [] },
  {
    value: "geometric",
    label: "Geometric decay",
    controls: ["centerWeight", "stepAmount"],
  },
  {
    value: "powerLaw",
    label: "Power-law decay",
    controls: ["centerWeight", "stepAmount"],
  },
];
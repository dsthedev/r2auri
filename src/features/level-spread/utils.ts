import {
  DECAY_FACTOR,
  DEFAULT_CENTER_WEIGHT,
  DEFAULT_GAUSSIAN_MID_BOOST,
  DEFAULT_GAUSSIAN_SPREAD,
  DEFAULT_MAX_LEVEL,
  DEFAULT_STEP_AMOUNT,
  distributionAlgorithms,
} from "@/features/level-spread/constants";
import type {
  AlgorithmControl,
  DistributionAlgorithm,
  LevelChanceEntry,
  LevelEntry,
} from "@/features/level-spread/types";

export function isDistributionAlgorithm(value: string): value is DistributionAlgorithm {
  return distributionAlgorithms.some((item) => item.value === value);
}

export function getCommentLabelForAlgorithm(algorithm: DistributionAlgorithm): string {
  const matched = distributionAlgorithms.find((item) => item.value === algorithm);
  if (!matched) {
    return "Manual";
  }

  return matched.label.replace(/\s*\(.+\)$/, "");
}

export function getAlgorithmFromCommentLabel(label: string | null | undefined): DistributionAlgorithm {
  if (!label) {
    return "manual";
  }

  const normalized = label.trim().toLowerCase();
  const matched = distributionAlgorithms.find((item) => {
    const direct = item.value.toLowerCase();
    const commentLabel = item.label.replace(/\s*\(.+\)$/, "").trim().toLowerCase();
    return normalized === direct || normalized === commentLabel;
  });

  return matched?.value ?? "manual";
}

export function getAlgorithmControls(algorithm: DistributionAlgorithm): AlgorithmControl[] {
  return distributionAlgorithms.find((item) => item.value === algorithm)?.controls ?? [];
}

export function parseLevelSpread(raw: string): LevelEntry[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(":"))
    .map((line) => {
      const [levelRaw, valueRaw] = line.split(":");
      return {
        level: Number.parseInt(levelRaw.trim(), 10),
        value: Number.parseFloat(valueRaw.trim()),
      };
    })
    .filter((entry) => Number.isFinite(entry.level) && Number.isFinite(entry.value))
    .sort((left, right) => left.level - right.level);
}

export function formatLevelSpread(entries: LevelEntry[]): string {
  return entries.map((entry) => `${entry.level}: ${entry.value.toFixed(4)}`).join("\n");
}

export function buildLevelEntries(maxLevel: number): LevelEntry[] {
  return Array.from({ length: maxLevel }, (_, index) => ({
    level: index + 1,
    value: 0,
  }));
}

export function buildEntriesFromParsed(parsed: LevelEntry[], maxLevel: number): LevelEntry[] {
  const byLevel = new Map(parsed.map((entry) => [entry.level, entry.value]));

  return Array.from({ length: maxLevel }, (_, index) => {
    const level = index + 1;
    return {
      level,
      value: byLevel.get(level) ?? 0,
    };
  });
}

export function resizeLevelEntries(entries: LevelEntry[], maxLevel: number): LevelEntry[] {
  return buildEntriesFromParsed(entries, maxLevel);
}

export function clampMaxLevel(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_LEVEL;
  }

  return Math.min(Math.max(Math.round(value), 2), 200);
}

export function clampCenterWeight(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_CENTER_WEIGHT;
  }

  return Math.min(Math.max(Math.round(value), 1), 100);
}

export function clampStepAmount(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_STEP_AMOUNT;
  }

  return Math.min(Math.max(Math.round(value * 10) / 10, 0.1), 10);
}

export function clampGaussianSpread(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_GAUSSIAN_SPREAD;
  }

  const numericValue = value ?? DEFAULT_GAUSSIAN_SPREAD;
  return Math.min(Math.max(Math.round(numericValue * 10) / 10, 0.3), 3);
}

export function clampGaussianMidBoost(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_GAUSSIAN_MID_BOOST;
  }

  const numericValue = value ?? DEFAULT_GAUSSIAN_MID_BOOST;
  return Math.min(Math.max(Math.round(numericValue * 10) / 10, 0.5), 3);
}

export function applyCenteredWeights(
  entries: LevelEntry[],
  centerIndex: number,
  algorithm: DistributionAlgorithm,
  centerWeight: number,
  tuningOptions: Partial<{
    stepAmount: number;
    gaussianSpread: number;
    gaussianMidBoost: number;
  }> = {}
): LevelEntry[] {
  const safeCenter = Math.min(Math.max(centerIndex, 0), Math.max(entries.length - 1, 0));
  const stepAmount = clampStepAmount(tuningOptions.stepAmount ?? DEFAULT_STEP_AMOUNT);
  const gaussianSpread = clampGaussianSpread(
    tuningOptions.gaussianSpread ?? DEFAULT_GAUSSIAN_SPREAD
  );
  const gaussianMidBoost = clampGaussianMidBoost(
    tuningOptions.gaussianMidBoost ?? DEFAULT_GAUSSIAN_MID_BOOST
  );

  return entries.map((entry, index) => {
    const distance = Math.abs(index - safeCenter);
    let rawValue = centerWeight * DECAY_FACTOR ** distance;

    if (algorithm === "gaussian") {
      const sigma = Math.max((entries.length / 6) * gaussianSpread, 1);
      const baseCurve = Math.exp(-(distance ** 2) / (2 * sigma ** 2));
      rawValue = centerWeight * baseCurve ** (1 / gaussianMidBoost);
    }

    if (algorithm === "linear") {
      const maxDistance = Math.max(entries.length - 1, 1);
      rawValue = centerWeight * Math.max(0, 1 - (distance * stepAmount) / maxDistance);
    }

    if (algorithm === "evenish") {
      const maxIndex = Math.max(entries.length - 1, 1);
      const step = 99 / maxIndex;
      rawValue = Math.max(1, 100 - step * index);
    }

    if (algorithm === "fibonacci") {
      rawValue = getFibonacciValue(Math.max(entries.length - 1 - index, 0));
    }

    if (algorithm === "geometric") {
      const ratio = 1 / (1 + stepAmount);
      rawValue = centerWeight * ratio ** index;
    }

    if (algorithm === "powerLaw") {
      const exponent = Math.max(stepAmount, 0.1);
      rawValue = centerWeight / (index + 1) ** exponent;
    }

    return {
      level: entry.level,
      value: Math.max(0, Number.isFinite(rawValue) ? rawValue : 0),
    };
  });
}

function getFibonacciValue(position: number) {
  if (position <= 1) {
    return 1;
  }

  let previous = 1;
  let current = 1;
  for (let step = 2; step <= position; step += 1) {
    const next = previous + current;
    previous = current;
    current = next;
  }
  return current;
}

export function getEffectiveLevelChances(entries: LevelEntry[]): LevelChanceEntry[] {
  let highestCoveredThreshold = 0;
  const byLevel = new Map<number, LevelChanceEntry>();

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const threshold = clampToRollRange(entry.value);
    const effectiveChance = Math.max(0, threshold - highestCoveredThreshold);

    byLevel.set(entry.level, {
      level: entry.level,
      value: entry.value,
      effectiveChance,
    });

    highestCoveredThreshold = Math.max(highestCoveredThreshold, threshold);
  }

  return entries
    .map((entry) => byLevel.get(entry.level))
    .filter((entry): entry is LevelChanceEntry => Boolean(entry));
}

function clampToRollRange(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

export function normalizeLevelWeights(entries: LevelEntry[], targetTotal = 100): LevelEntry[] {
  if (!Number.isFinite(targetTotal) || targetTotal <= 0 || entries.length === 0) {
    return entries;
  }

  const currentTotal = entries.reduce((sum, entry) => sum + Math.max(0, entry.value), 0);
  if (!Number.isFinite(currentTotal) || currentTotal <= 0) {
    return entries;
  }

  const scale = targetTotal / currentTotal;
  return entries.map((entry) => ({
    level: entry.level,
    value: Math.max(0, entry.value) * scale,
  }));
}

export function normalizeEffectiveLevelWeights(
  entries: LevelEntry[],
  targetTotal = 100
): LevelEntry[] {
  if (!Number.isFinite(targetTotal) || targetTotal <= 0 || entries.length === 0) {
    return entries;
  }

  const currentTotal = getEffectiveLevelChances(entries).reduce(
    (sum, entry) => sum + entry.effectiveChance,
    0
  );
  if (!Number.isFinite(currentTotal) || currentTotal <= 0) {
    return entries;
  }

  const scale = targetTotal / currentTotal;
  return entries.map((entry) => ({
    level: entry.level,
    value: Math.max(0, entry.value) * scale,
  }));
}
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DistributionControls } from "@/features/level-spread/components/distribution-controls";
import { OutputTable } from "@/features/level-spread/components/output-table";
import { PreviewPanel } from "@/features/level-spread/components/preview-panel";
import {
  DEFAULT_CENTER_WEIGHT,
  DEFAULT_GAUSSIAN_MID_BOOST,
  DEFAULT_GAUSSIAN_SPREAD,
  DEFAULT_MAX_LEVEL,
  DEFAULT_STEP_AMOUNT,
} from "@/features/level-spread/constants";
import type { DistributionAlgorithm, LevelEntry } from "@/features/level-spread/types";
import {
  applyCenteredWeights,
  buildEntriesFromParsed,
  buildLevelEntries,
  clampCenterWeight,
  clampGaussianMidBoost,
  clampGaussianSpread,
  clampMaxLevel,
  clampStepAmount,
  formatLevelSpread,
  getAlgorithmFromCommentLabel,
  getAlgorithmControls,
  getCommentLabelForAlgorithm,
  normalizeEffectiveLevelWeights,
  normalizeLevelWeights,
  resizeLevelEntries,
} from "@/features/level-spread/utils";

type LevelSettingsDocument = {
  filePath: string;
  algorithmComment: string | null;
  entries: LevelEntry[];
};

export function LevelSpreadPage({ configPath }: { configPath: string | null }) {
  const [sourceEntries, setSourceEntries] = useState<LevelEntry[]>(() =>
    buildLevelEntries(DEFAULT_MAX_LEVEL)
  );
  const [loadedEntries, setLoadedEntries] = useState<LevelEntry[]>([]);
  const [loadedAlgorithm, setLoadedAlgorithm] = useState<DistributionAlgorithm>("manual");
  const [algorithmPreviewEnabled, setAlgorithmPreviewEnabled] = useState(false);
  const [maxLevel, setMaxLevel] = useState(DEFAULT_MAX_LEVEL);
  const [centerWeight, setCenterWeight] = useState(DEFAULT_CENTER_WEIGHT);
  const [stepAmount, setStepAmount] = useState(DEFAULT_STEP_AMOUNT);
  const [gaussianSpread, setGaussianSpread] = useState(DEFAULT_GAUSSIAN_SPREAD);
  const [gaussianMidBoost, setGaussianMidBoost] = useState(DEFAULT_GAUSSIAN_MID_BOOST);
  const [algorithm, setAlgorithm] = useState<DistributionAlgorithm>("manual");
  const [normalizationMode, setNormalizationMode] = useState<"none" | "weight" | "chance">("none");
  const [centerPosition, setCenterPosition] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const safeCenterPosition = clampPosition(centerPosition, sourceEntries.length);
  const algorithmControls = getAlgorithmControls(algorithm);

  const weightedEntries = useMemo(() => {
    if (sourceEntries.length === 0) {
      return [];
    }

    if (algorithm === "manual") {
      return sourceEntries;
    }

    if (!algorithmPreviewEnabled) {
      return sourceEntries;
    }

    const generated = applyCenteredWeights(sourceEntries, safeCenterPosition - 1, algorithm, centerWeight, {
      stepAmount,
      gaussianSpread,
      gaussianMidBoost,
    });

    if (normalizationMode === "weight") {
      return normalizeLevelWeights(generated, 100);
    }

    if (normalizationMode === "chance") {
      return normalizeEffectiveLevelWeights(generated, 100);
    }

    return generated;
  }, [
    algorithm,
    centerWeight,
    gaussianMidBoost,
    gaussianSpread,
    normalizationMode,
    safeCenterPosition,
    sourceEntries,
    stepAmount,
  ]);

  const selectedLevel =
    sourceEntries[Math.max(0, safeCenterPosition - 1)]?.level ?? sourceEntries[0]?.level ?? null;
  const isDirty =
    formatLevelSpread(weightedEntries) !== formatLevelSpread(loadedEntries) ||
    algorithm !== loadedAlgorithm;

  useEffect(() => {
    if (!configPath) {
      return;
    }

    void loadDocument(configPath);
  }, [configPath]);

  const loadDocument = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      setSaveMessage(null);
      const document = await invoke<LevelSettingsDocument>("read_level_settings", {
        configPath: path,
      });
      applyLoadedEntries(document.entries, document.algorithmComment);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const applyLoadedEntries = (entries: LevelEntry[], algorithmComment: string | null) => {
    const parsed = [...entries].sort((left, right) => left.level - right.level);
    const inferredMaxLevel = clampMaxLevel(Math.max(...parsed.map((entry) => entry.level)));
    const normalizedEntries = buildEntriesFromParsed(parsed, inferredMaxLevel);
    const detectedAlgorithm = getAlgorithmFromCommentLabel(algorithmComment);

    setLoadedEntries(normalizedEntries);
    setSourceEntries(normalizedEntries);
    setLoadedAlgorithm(detectedAlgorithm);
    setMaxLevel(inferredMaxLevel);
    setCenterWeight(DEFAULT_CENTER_WEIGHT);
    setStepAmount(DEFAULT_STEP_AMOUNT);
    setGaussianSpread(DEFAULT_GAUSSIAN_SPREAD);
    setGaussianMidBoost(DEFAULT_GAUSSIAN_MID_BOOST);
    setAlgorithm(detectedAlgorithm);
    setAlgorithmPreviewEnabled(false);
    setNormalizationMode("none");
    setCenterPosition(1);
    setCopied(false);
  };

  const handleSave = async () => {
    if (!configPath) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await invoke("save_level_settings", {
        configPath,
        entries: weightedEntries,
        algorithmComment: getCommentLabelForAlgorithm(algorithm),
      });
      setLoadedEntries(weightedEntries);
      setSourceEntries(weightedEntries);
      setLoadedAlgorithm(algorithm);
      setAlgorithmPreviewEnabled(false);
      setSaveMessage("Level settings saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSaveMessage(null);
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    if (!configPath) {
      return;
    }

    await loadDocument(configPath);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      ["defaultCreatureLevelUpChance:", `  # alogorithm: ${getCommentLabelForAlgorithm(algorithm)}`, formatLevelSpread(weightedEntries).split("\n").map((line) => `  ${line}`).join("\n")].join("\n")
    );
    setCopied(true);
  };

  const handleEntryValueChange = (level: number, value: number) => {
    const nextValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    setSourceEntries((current) =>
      current.map((entry) =>
        entry.level === level
          ? {
              ...entry,
              value: nextValue,
            }
          : entry
      )
    );
    setCopied(false);
    setSaveMessage(null);
  };

  return (
    <div className="flex-1 overflow-auto px-5 py-3">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Level Spread</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Edit the defaultCreatureLevelUpChance table directly from the active profile.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleReload} disabled={!configPath || loading || saving}>Reload File</Button>
            <Button variant="outline" onClick={handleCopy} disabled={weightedEntries.length === 0}>Copy Output</Button>
            <Button onClick={handleSave} disabled={!configPath || saving || loading || !isDirty}>Save To File</Button>
          </div>
        </div>

        <Card className="border border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle>Source File</CardTitle>
            <CardDescription>
              Reads and writes the defaultCreatureLevelUpChance section and its algorithm comment in the detected SLS config.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="font-mono text-xs break-all text-foreground/90">{configPath ?? "No config detected."}</p>
            <p>
              Current comment: <span className="font-mono text-foreground/90"># alogorithm: {getCommentLabelForAlgorithm(algorithm)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {loading && <span>Loading current file...</span>}
              {saving && <span>Saving current spread...</span>}
              {copied && <span>Copied formatted output.</span>}
              {saveMessage && <span className="text-roygbiv-green">{saveMessage}</span>}
              {isDirty && !saving && <span className="text-roygbiv-orange">Unsaved changes</span>}
            </div>
            {error && <p className="text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <PreviewPanel algorithm={algorithm} centerLevel={selectedLevel} entries={weightedEntries} error={error} />
            <OutputTable
              entries={weightedEntries}
              editable={algorithm === "manual"}
              onValueChange={handleEntryValueChange}
            />
          </div>

          <div className="space-y-6">
            <DistributionControls
              algorithm={algorithm}
              algorithmControls={algorithmControls}
              centerPosition={safeCenterPosition}
              centerWeight={centerWeight}
              gaussianSpread={gaussianSpread}
              gaussianMidBoost={gaussianMidBoost}
              maxLevel={maxLevel}
              normalizationMode={normalizationMode}
              selectedLevelLabel={selectedLevel ?? 1}
              stepAmount={stepAmount}
              onAlgorithmChange={(value) => {
                setAlgorithm(value);
                setAlgorithmPreviewEnabled(value !== "manual");
                setNormalizationMode("none");
                setCopied(false);
                setSaveMessage(null);
              }}
              onCenterPositionChange={(value) => {
                setAlgorithmPreviewEnabled(algorithm !== "manual");
                setCenterPosition(clampPosition(value, sourceEntries.length));
              }}
              onCenterWeightChange={(value) => {
                setAlgorithmPreviewEnabled(algorithm !== "manual");
                setCenterWeight(clampCenterWeight(value));
              }}
              onGaussianSpreadChange={(value) => {
                setAlgorithmPreviewEnabled(algorithm !== "manual");
                setGaussianSpread(clampGaussianSpread(value));
              }}
              onGaussianMidBoostChange={(value) => {
                setAlgorithmPreviewEnabled(algorithm !== "manual");
                setGaussianMidBoost(clampGaussianMidBoost(value));
              }}
              onMaxLevelChange={(value) => {
                const clamped = clampMaxLevel(value);
                setAlgorithmPreviewEnabled(algorithm !== "manual");
                setMaxLevel(clamped);
                setSourceEntries((current) => resizeLevelEntries(current, clamped));
                setCenterPosition((current) => clampPosition(current, clamped));
              }}
              onNormalizationModeChange={(value) => {
                setAlgorithmPreviewEnabled(algorithm !== "manual" && value !== "none");
                setNormalizationMode(value);
              }}
              onStepAmountChange={(value) => {
                setAlgorithmPreviewEnabled(algorithm !== "manual");
                setStepAmount(clampStepAmount(value));
              }}
            />

            <Card className="border border-border/80 bg-card/80">
              <CardHeader>
                <CardTitle>Formatted YAML Preview</CardTitle>
                <CardDescription>
                  This is the exact section shape that will be written back to LevelSettings.yaml.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  value={["defaultCreatureLevelUpChance:", `  # alogorithm: ${getCommentLabelForAlgorithm(algorithm)}`, formatLevelSpread(weightedEntries).split("\n").map((line) => `  ${line}`).join("\n")].join("\n")}
                  readOnly
                  className="min-h-72 w-full rounded-none border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function clampPosition(position: number, length: number) {
  if (length <= 0 || !Number.isFinite(position)) {
    return 1;
  }

  return Math.min(Math.max(position, 1), length);
}
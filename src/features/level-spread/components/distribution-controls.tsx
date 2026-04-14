import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { distributionAlgorithms } from "@/features/level-spread/constants";
import type {
  AlgorithmControl,
  DistributionAlgorithm,
} from "@/features/level-spread/types";

type Props = {
  algorithm: DistributionAlgorithm;
  algorithmControls: AlgorithmControl[];
  centerPosition: number;
  centerWeight: number;
  gaussianSpread: number;
  gaussianMidBoost: number;
  maxLevel: number;
  normalizationMode: "none" | "weight" | "chance";
  selectedLevelLabel: number;
  stepAmount: number;
  onAlgorithmChange: (value: DistributionAlgorithm) => void;
  onCenterPositionChange: (value: number) => void;
  onCenterWeightChange: (value: number) => void;
  onGaussianSpreadChange: (value: number) => void;
  onGaussianMidBoostChange: (value: number) => void;
  onMaxLevelChange: (value: number) => void;
  onNormalizationModeChange: (value: "none" | "weight" | "chance") => void;
  onStepAmountChange: (value: number) => void;
};

export function DistributionControls(props: Props) {
  const {
    algorithm,
    algorithmControls,
    centerPosition,
    centerWeight,
    gaussianSpread,
    gaussianMidBoost,
    maxLevel,
    normalizationMode,
    selectedLevelLabel,
    stepAmount,
    onAlgorithmChange,
    onCenterPositionChange,
    onCenterWeightChange,
    onGaussianSpreadChange,
    onGaussianMidBoostChange,
    onMaxLevelChange,
    onNormalizationModeChange,
    onStepAmountChange,
  } = props;

  return (
    <Card className="border border-border/80 bg-card/80">
      <CardHeader>
        <CardTitle>Distribution Controls</CardTitle>
        <CardDescription>
          Choose an algorithm, tune the curve, and normalize the generated thresholds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Algorithm</p>
          <Select value={algorithm} onValueChange={(value) => onAlgorithmChange(value as DistributionAlgorithm)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {distributionAlgorithms.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Normalization</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={normalizationMode === "none" ? "default" : "outline"} onClick={() => onNormalizationModeChange("none")}>Off</Button>
            <Button size="sm" variant={normalizationMode === "weight" ? "default" : "outline"} onClick={() => onNormalizationModeChange("weight")} disabled={algorithm === "manual"}>By weight</Button>
            <Button size="sm" variant={normalizationMode === "chance" ? "default" : "outline"} onClick={() => onNormalizationModeChange("chance")} disabled={algorithm === "manual"}>By chance</Button>
          </div>
          {algorithm === "manual" && (
            <p className="text-xs text-muted-foreground">
              Manual mode preserves the loaded YAML values exactly and only allows direct edits.
            </p>
          )}
        </div>

        {algorithmControls.includes("centerPosition") && (
          <RangeControl
            label={`Center level: L${selectedLevelLabel}`}
            max={Math.max(maxLevel, 1)}
            min={1}
            numberValue={centerPosition}
            onChange={(value) => onCenterPositionChange(Number.parseInt(value, 10))}
            step={1}
            value={centerPosition}
          />
        )}

        {algorithmControls.includes("centerWeight") && (
          <RangeControl
            label="Center weight"
            max={100}
            min={1}
            numberValue={centerWeight}
            onChange={(value) => onCenterWeightChange(Number.parseInt(value, 10))}
            step={1}
            value={centerWeight}
          />
        )}

        {algorithmControls.includes("gaussianSpread") && (
          <RangeControl
            label="Gaussian spread"
            max={3}
            min={0.3}
            numberValue={gaussianSpread}
            onChange={(value) => onGaussianSpreadChange(Number.parseFloat(value))}
            step={0.1}
            value={gaussianSpread}
          />
        )}

        {algorithmControls.includes("gaussianMidBoost") && (
          <RangeControl
            label="Gaussian mid boost"
            max={3}
            min={0.5}
            numberValue={gaussianMidBoost}
            onChange={(value) => onGaussianMidBoostChange(Number.parseFloat(value))}
            step={0.1}
            value={gaussianMidBoost}
          />
        )}

        <RangeControl
          label="Max level"
          max={200}
          min={2}
          numberValue={maxLevel}
          onChange={(value) => onMaxLevelChange(Number.parseInt(value, 10))}
          step={1}
          value={maxLevel}
        />

        {algorithmControls.includes("stepAmount") && (
          <RangeControl
            label="Step amount"
            max={10}
            min={0.1}
            numberValue={stepAmount}
            onChange={(value) => onStepAmountChange(Number.parseFloat(value))}
            step={0.1}
            value={stepAmount}
          />
        )}
      </CardContent>
    </Card>
  );
}

function RangeControl({
  label,
  max,
  min,
  numberValue,
  onChange,
  step,
  value,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  numberValue: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <Input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="h-3 cursor-pointer appearance-none rounded-full border-0 bg-transparent px-0 py-0 [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-thumb]:-mt-0.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background" />
        <Input type="number" min={min} max={max} step={step} value={numberValue} onChange={(event) => onChange(event.target.value)} className="w-20" />
      </div>
    </div>
  );
}
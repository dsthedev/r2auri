import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LevelEntry } from "@/features/level-spread/types";
import { getEffectiveLevelChances } from "@/features/level-spread/utils";

export function OutputTable({
  entries,
  editable,
  onValueChange,
}: {
  entries: LevelEntry[];
  editable: boolean;
  onValueChange: (level: number, value: number) => void;
}) {
  const effectiveEntries = getEffectiveLevelChances(entries);

  return (
    <Card className="border border-border/80 bg-card/80">
      <CardHeader>
        <CardTitle>Output</CardTitle>
        <CardDescription>
          Save writes the current thresholds back into defaultCreatureLevelUpChance. Manual mode edits values directly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-auto border border-border/80 bg-background/50">
          <div className="grid grid-cols-[80px_1fr_1fr] border-b border-border/80 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span>Level</span>
            <span className="text-right">Weight</span>
            <span className="text-right">Effective</span>
          </div>
          {effectiveEntries.map((entry) => (
            <div key={entry.level} className="grid grid-cols-[80px_1fr_1fr] border-b border-border/60 px-3 py-2 text-sm last:border-b-0">
              <span>L{entry.level}</span>
              <span className="text-right font-mono">
                {editable ? (
                  <Input
                    type="number"
                    step={0.0001}
                    min={0}
                    value={Number.isFinite(entry.value) ? entry.value : 0}
                    onChange={(event) => onValueChange(entry.level, Number.parseFloat(event.target.value))}
                    className="ml-auto h-8 w-28 text-right font-mono"
                  />
                ) : (
                  entry.value.toFixed(4)
                )}
              </span>
              <span className="text-right font-mono">{entry.effectiveChance.toFixed(4)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
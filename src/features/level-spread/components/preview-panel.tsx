import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributionAlgorithm, LevelEntry } from "@/features/level-spread/types";
import { getEffectiveLevelChances } from "@/features/level-spread/utils";

export function PreviewPanel({
  algorithm,
  centerLevel,
  entries,
  error,
}: {
  algorithm: DistributionAlgorithm;
  centerLevel: number | null;
  entries: LevelEntry[];
  error: string | null;
}) {
  const effectiveEntries = getEffectiveLevelChances(entries);
  const peakValue = entries.reduce((max, entry) => Math.max(max, entry.value), 0);
  const effectiveTotal = effectiveEntries.reduce((sum, entry) => sum + entry.effectiveChance, 0);
  const centerIndex = centerLevel === null ? -1 : entries.findIndex((entry) => entry.level === centerLevel);

  return (
    <Card className="border border-border/80 bg-card/80">
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          Bars use a fixed 0-100 scale so you can compare threshold shape directly against the live config.
        </CardDescription>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Algorithm: {algorithm}</Badge>
          <Badge variant="outline">Center: {centerLevel ?? "-"}</Badge>
          <Badge variant="outline">Peak: {peakValue.toFixed(4)}</Badge>
          <Badge>Effective total: {effectiveTotal.toFixed(4)}%</Badge>
          {error ? <Badge variant="destructive">{error}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries loaded.</p>
        ) : (
          <div className="relative overflow-hidden rounded-none border border-border/80 bg-background/60 px-3 py-4">
            <div className="pointer-events-none absolute inset-y-4 left-3 flex flex-col justify-between text-[10px] text-muted-foreground">
              <span>100</span>
              <span>50</span>
              <span>0</span>
            </div>
            <div className="ml-7 flex h-64 items-end gap-1 overflow-hidden">
              {entries.map((entry, index) => {
                const weightHeight = Math.min(Math.max(entry.value, 0), 100);
                const effectiveHeight = Math.min(
                  Math.max(effectiveEntries[index]?.effectiveChance ?? 0, 0),
                  100
                );
                const distanceFromCenter = centerIndex < 0 ? 0 : Math.abs(index - centerIndex);
                const isCenter = distanceFromCenter === 0;

                return (
                  <div key={entry.level} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
                    <div
                      className={`flex w-full flex-1 items-end justify-center gap-1 border border-border/40 px-1 py-1 ${
                        isCenter ? "bg-primary/5" : "bg-muted/20"
                      }`}
                    >
                      <div
                        className="w-full bg-blue-500 transition-all duration-200"
                        style={{ height: `${Math.max(weightHeight, entry.value > 0 ? 1 : 0)}%` }}
                        title={`L${entry.level} weight: ${entry.value.toFixed(4)}`}
                      />
                      <div
                        className="w-full bg-green-500 transition-all duration-200"
                        style={{
                          height: `${Math.max(
                            effectiveHeight,
                            (effectiveEntries[index]?.effectiveChance ?? 0) > 0 ? 1 : 0
                          )}%`,
                        }}
                        title={`L${entry.level} effective: ${(effectiveEntries[index]?.effectiveChance ?? 0).toFixed(4)}%`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{entry.level}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 ml-7 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 bg-blue-500" />
                Weight
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 bg-green-500" />
                Effective %
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
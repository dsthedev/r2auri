import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LevelSpreadPage({ configPath }: { configPath: string | null }) {
  return (
    <div className="flex-1 overflow-auto px-5 py-3 flex flex-col max-w-5xl w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Level Spread</h1>
        <p className="text-sm text-muted-foreground">
          Reimplementation target for SLS level distribution editing.
        </p>
      </div>

      <Card className="border border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle>Implementation Started</CardTitle>
          <CardDescription>
            This page is now wired to profile-aware feature detection and will host the full level spread tool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Detected config path:</p>
          <p className="font-mono text-xs break-all text-foreground/90">
            {configPath ?? "Not detected"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
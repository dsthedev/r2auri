import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Pulse,
  TerminalWindow,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ProfileLogSnapshot, TailChunk, TailSessionStart } from "@/types/profile-log";

const MIN_TAIL_HEIGHT = 180;
const MAX_TAIL_HEIGHT = 420;
const DEFAULT_TAIL_HEIGHT = 220;
const MAX_TAIL_LINES = 500;

export function ProfileLogView({ modsPath, profile }: { modsPath: string; profile: string }) {
  const [snapshot, setSnapshot] = useState<ProfileLogSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [tailOpen, setTailOpen] = useState(false);
  const [tailHeight, setTailHeight] = useState(DEFAULT_TAIL_HEIGHT);
  const [tailLines, setTailLines] = useState<string[]>([]);
  const [tailStatus, setTailStatus] = useState<"idle" | "connecting" | "running" | "stopped">("idle");
  const [tailError, setTailError] = useState<string | null>(null);
  const [tailShell, setTailShell] = useState("");
  const [tailCommand, setTailCommand] = useState("");

  const tailSessionIdRef = useRef<string | null>(null);
  const tailPollInFlightRef = useRef(false);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      void stopTailSession();
    };
  }, []);

  useEffect(() => {
    setTailOpen(false);
    setTailLines([]);
    setTailError(null);
    setTailStatus("idle");
    void stopTailSession();
    void loadSnapshot();
  }, [modsPath, profile]);

  useEffect(() => {
    if (!tailOpen) {
      setTailStatus("idle");
      setTailError(null);
      setTailLines([]);
      void stopTailSession();
      return;
    }

    let disposed = false;
    let intervalId: number | null = null;

    const pumpTail = async (sessionId: string) => {
      if (tailPollInFlightRef.current) return;
      tailPollInFlightRef.current = true;

      try {
        const chunk = await invoke<TailChunk>("read_profile_log_tail", { sessionId });
        if (disposed) return;

        if (chunk.lines.length > 0) {
          setTailLines((current) => [...current, ...chunk.lines].slice(-MAX_TAIL_LINES));
        }

        setTailStatus(chunk.running ? "running" : "stopped");
      } catch (err) {
        if (!disposed) {
          const message = err instanceof Error ? err.message : String(err);
          setTailError(message);
          setTailStatus("stopped");
        }
      } finally {
        tailPollInFlightRef.current = false;
      }
    };

    const startTail = async () => {
      try {
        setTailStatus("connecting");
        setTailError(null);
        setTailLines([]);

        const session = await invoke<TailSessionStart>("start_profile_log_tail", {
          modsPath,
          profile,
        });

        if (disposed) {
          await invoke("stop_profile_log_tail", { sessionId: session.sessionId }).catch(() => undefined);
          return;
        }

        tailSessionIdRef.current = session.sessionId;
        setTailShell(session.shell);
        setTailCommand(session.command);
        setTailStatus("running");

        await pumpTail(session.sessionId);
        intervalId = window.setInterval(() => {
          const activeSessionId = tailSessionIdRef.current;
          if (activeSessionId) {
            void pumpTail(activeSessionId);
          }
        }, 500);
      } catch (err) {
        if (!disposed) {
          const message = err instanceof Error ? err.message : String(err);
          setTailError(message);
          setTailStatus("stopped");
        }
      }
    };

    void startTail();

    return () => {
      disposed = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      void stopTailSession();
    };
  }, [tailOpen, modsPath, profile]);

  const loadSnapshot = async () => {
    try {
      setLoadingSnapshot(true);
      setSnapshotError(null);
      const result = await invoke<ProfileLogSnapshot>("get_profile_log_snapshot", {
        modsPath,
        profile,
      });
      setSnapshot(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSnapshotError(message);
      setSnapshot(null);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const stopTailSession = async () => {
    const sessionId = tailSessionIdRef.current;
    tailSessionIdRef.current = null;

    if (!sessionId) return;

    try {
      await invoke("stop_profile_log_tail", { sessionId });
    } catch {
      return;
    }
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = tailHeight;

    const handleMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY);
      setTailHeight(Math.max(MIN_TAIL_HEIGHT, Math.min(MAX_TAIL_HEIGHT, nextHeight)));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      resizeCleanupRef.current = null;
    };

    resizeCleanupRef.current?.();
    resizeCleanupRef.current = handleUp;

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Collapsible open={tailOpen} onOpenChange={setTailOpen}>
        <Card className="border border-border/80 bg-card/80">
          <CardHeader className="gap-3 border-b border-border/70">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TerminalWindow size={18} className="text-primary" />
                  Live Tail
                </CardTitle>
                <CardDescription>
                  Runs a live tail in the backend using the system shell. Collapsed by default so it stays secondary to the table.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={tailStatus === "running" ? "default" : "outline"} className="gap-1">
                  <Pulse size={10} weight="fill" />
                  {tailStatus}
                </Badge>
                <CollapsibleTrigger
                  render={
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" />
                  }
                >
                  {tailOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}
                  {tailOpen ? "Hide Live Tail" : "Show Live Tail"}
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-3 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Shell: {tailShell || "starting..."}</span>
                <span className="max-w-full truncate">{tailCommand || "waiting for tail command"}</span>
              </div>

              {tailError && (
                <div className="border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {tailError}
                </div>
              )}

              <div className="overflow-hidden border border-border/70 bg-background/70">
                <div
                  aria-hidden="true"
                  className="h-3 cursor-row-resize border-b border-border/70 bg-muted/40"
                  onPointerDown={handleResizeStart}
                />
                <ScrollArea className="w-full" style={{ height: `${tailHeight}px` }}>
                  <pre className="min-h-full px-3 py-2 font-mono text-xs leading-5 text-foreground/90 whitespace-pre-wrap wrap-break-word">
                    {tailLines.length > 0
                      ? tailLines.join("\n")
                      : tailStatus === "connecting"
                        ? "Starting tail session..."
                        : "Open the panel while the log is active to stream new lines here."}
                  </pre>
                </ScrollArea>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="flex min-h-0 flex-1 flex-col border border-border/80 bg-card/80">
        <CardHeader className="gap-3 border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Log Snapshot</CardTitle>
              <CardDescription>
                Full file view of BepInEx/LogOutput.log with parsed level and source columns.
              </CardDescription>
            </div>

            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void loadSnapshot()}>
              <ArrowsClockwise size={14} />
              Reload Table
            </Button>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{snapshot?.path || "Loading log path..."}</span>
            <span>{snapshot ? `${snapshot.totalLines} lines` : loadingSnapshot ? "Loading..." : "No data"}</span>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col pt-4">
          {snapshotError && (
            <div className="border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Failed to load log snapshot: {snapshotError}
            </div>
          )}

          {loadingSnapshot && !snapshot && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading log snapshot...
            </div>
          )}

          {!loadingSnapshot && snapshot && (
            <ScrollArea className="min-h-0 flex-1 border border-border/70 bg-background/50">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10 bg-card/95 text-left">
                  <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-20 border-b border-border/70 px-3 py-2 font-medium">Line</th>
                    <th className="w-32 border-b border-border/70 px-3 py-2 font-medium">Level</th>
                    <th className="w-48 border-b border-border/70 px-3 py-2 font-medium">Source</th>
                    <th className="border-b border-border/70 px-3 py-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.lines.map((line) => (
                    <tr key={line.lineNumber} className="align-top odd:bg-muted/10">
                      <td className="border-b border-border/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                        {line.lineNumber}
                      </td>
                      <td className="border-b border-border/40 px-3 py-2">
                        <LevelBadge level={line.level} />
                      </td>
                      <td className="border-b border-border/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                        {line.source || "-"}
                      </td>
                      <td className="border-b border-border/40 px-3 py-2 font-mono text-xs leading-5 text-foreground/90">
                        {line.message || line.raw}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const normalizedLevel = level.trim().toLowerCase();

  if (!normalizedLevel) {
    return <Badge variant="outline">raw</Badge>;
  }

  if (normalizedLevel.startsWith("error")) {
    return <Badge variant="destructive">{level.trim()}</Badge>;
  }

  if (normalizedLevel.startsWith("warning")) {
    return <Badge variant="secondary" className="bg-amber-500/15 text-amber-300">
      {level.trim()}
    </Badge>;
  }

  if (normalizedLevel.startsWith("info")) {
    return <Badge variant="outline">{level.trim()}</Badge>;
  }

  return <Badge variant="outline">{level.trim()}</Badge>;
}
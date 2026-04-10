import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Pulse,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ProfileLogSnapshot,
  TailChunk,
  TailSessionStart,
} from "@/types/profile-log";

const MIN_TAIL_HEIGHT = 180;
const MAX_TAIL_HEIGHT = 420;
const DEFAULT_TAIL_HEIGHT = 220;
const MAX_TAIL_LINES = 500;
const TAIL_AUTO_SCROLL_PAUSE_MS = 4000;
const TAIL_BOTTOM_THRESHOLD_PX = 24;

type LogSection = "tail" | "snapshot" | null;

export function ProfileLogView({
  modsPath,
  profile,
}: {
  modsPath: string;
  profile: string;
}) {
  const [snapshot, setSnapshot] = useState<ProfileLogSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<LogSection>("snapshot");
  const [tailEnabled, setTailEnabled] = useState(false);
  const [tailHeight, setTailHeight] = useState(DEFAULT_TAIL_HEIGHT);
  const [tailLines, setTailLines] = useState<string[]>([]);
  const [tailStatus, setTailStatus] = useState<
    "idle" | "connecting" | "running" | "stopped"
  >("idle");
  const [tailError, setTailError] = useState<string | null>(null);
  const [tailShell, setTailShell] = useState("");
  const [tailCommand, setTailCommand] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const tailSessionIdRef = useRef<string | null>(null);
  const tailPollInFlightRef = useRef(false);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const tailViewportRef = useRef<HTMLDivElement | null>(null);
  const tailAutoScrollPauseUntilRef = useRef(0);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      void stopTailSession();
    };
  }, []);

  useEffect(() => {
    setOpenSection("snapshot");
    setTailEnabled(false);
    setTailLines([]);
    setTailError(null);
    setTailStatus("idle");
    setLevelFilter("all");
    setSourceFilter("all");
    setSearchQuery("");
    void stopTailSession();
    void loadSnapshot();
  }, [modsPath, profile]);

  useEffect(() => {
    if (openSection !== "tail" && tailEnabled) {
      setTailEnabled(false);
    }
  }, [openSection, tailEnabled]);

  useEffect(() => {
    if (!tailEnabled) {
      setTailStatus("idle");
      setTailError(null);
      setTailLines([]);
      tailAutoScrollPauseUntilRef.current = 0;
      void stopTailSession();
      return;
    }

    let disposed = false;
    let intervalId: number | null = null;

    const pumpTail = async (sessionId: string) => {
      if (tailPollInFlightRef.current) return;
      tailPollInFlightRef.current = true;

      try {
        const chunk = await invoke<TailChunk>("read_profile_log_tail", {
          sessionId,
        });
        if (disposed) return;

        if (chunk.lines.length > 0) {
          setTailLines((current) =>
            [...current, ...chunk.lines].slice(-MAX_TAIL_LINES),
          );
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

        const session = await invoke<TailSessionStart>(
          "start_profile_log_tail",
          {
            modsPath,
            profile,
          },
        );

        if (disposed) {
          await invoke("stop_profile_log_tail", {
            sessionId: session.sessionId,
          }).catch(() => undefined);
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
  }, [tailEnabled, modsPath, profile]);

  useEffect(() => {
    if (!tailEnabled) return;

    const viewport = tailViewportRef.current;
    if (!viewport) return;

    const isNearBottom = getIsNearBottom(viewport);
    const pauseExpired = Date.now() >= tailAutoScrollPauseUntilRef.current;

    if (isNearBottom || pauseExpired) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [tailEnabled, tailLines]);

  const searchNeedle = searchQuery.trim().toLowerCase();

  const lines = snapshot?.lines ?? [];

  const searchFilteredLines = useMemo(() => {
    if (!searchNeedle) return lines;

    return lines.filter((line) => {
      const blob = `${line.raw}\n${line.source}\n${line.message}`.toLowerCase();
      return blob.includes(searchNeedle);
    });
  }, [lines, searchNeedle]);

  const sourceAwareLines = useMemo(() => {
    if (sourceFilter === "all") return searchFilteredLines;
    return searchFilteredLines.filter(
      (line) => getSourceKey(line.source) === sourceFilter,
    );
  }, [searchFilteredLines, sourceFilter]);

  const levelAwareLines = useMemo(() => {
    if (levelFilter === "all") return searchFilteredLines;
    return searchFilteredLines.filter(
      (line) => getLevelKey(line.level) === levelFilter,
    );
  }, [searchFilteredLines, levelFilter]);

  const filteredLines = useMemo(() => {
    return searchFilteredLines.filter((line) => {
      const levelMatches =
        levelFilter === "all" || getLevelKey(line.level) === levelFilter;
      const sourceMatches =
        sourceFilter === "all" || getSourceKey(line.source) === sourceFilter;
      return levelMatches && sourceMatches;
    });
  }, [searchFilteredLines, levelFilter, sourceFilter]);

  const levelCounts = useMemo(
    () => makeCountEntries(sourceAwareLines, (line) => getLevelKey(line.level)),
    [sourceAwareLines],
  );
  const sourceCounts = useMemo(
    () =>
      makeCountEntries(levelAwareLines, (line) => getSourceKey(line.source)),
    [levelAwareLines],
  );

  const sourceOptions = useMemo(
    () =>
      Array.from(sourceCounts.entries()).sort((left, right) => {
        const countDiff = right[1] - left[1];
        if (countDiff !== 0) return countDiff;
        return left[0].localeCompare(right[0]);
      }),
    [sourceCounts],
  );

  const loadSnapshot = async () => {
    try {
      setLoadingSnapshot(true);
      setSnapshotError(null);
      const result = await invoke<ProfileLogSnapshot>(
        "get_profile_log_snapshot",
        {
          modsPath,
          profile,
        },
      );
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
      setTailHeight(
        Math.max(MIN_TAIL_HEIGHT, Math.min(MAX_TAIL_HEIGHT, nextHeight)),
      );
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

  const handleTailScroll = () => {
    const viewport = tailViewportRef.current;
    if (!viewport) return;

    if (getIsNearBottom(viewport)) {
      tailAutoScrollPauseUntilRef.current = 0;
      return;
    }

    tailAutoScrollPauseUntilRef.current =
      Date.now() + TAIL_AUTO_SCROLL_PAUSE_MS;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <AccordionSection
        title="Live Tail"
        description="Shell-backed live stream for new log lines. Expanding the section does not start streaming by itself."
        isOpen={openSection === "tail"}
        onToggle={() =>
          setOpenSection((current) => (current === "tail" ? null : "tail"))
        }
        headerContent={
          <Badge
            variant={tailStatus === "running" ? "default" : "outline"}
            className="gap-1"
          >
            <Pulse size={10} weight="fill" />
            {tailStatus}
          </Badge>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Shell: {tailShell || "idle"}</span>
              <span className="max-w-full truncate">
                {tailCommand || "No live tail process running"}
              </span>
            </div>

            <Button
              type="button"
              variant={tailEnabled ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setTailEnabled((current) => !current)}
            >
              {tailEnabled ? <CaretDown size={14} /> : <CaretRight size={14} />}
              {tailEnabled ? "Hide Tail Output" : "Show Live Tail"}
            </Button>
          </div>

          {tailError && (
            <div className="border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {tailError}
            </div>
          )}

          {tailEnabled ? (
            <div className="overflow-hidden border border-border/70 bg-background/70">
              <div
                aria-hidden="true"
                className="h-3 cursor-row-resize border-b border-border/70 bg-muted/40"
                onPointerDown={handleResizeStart}
              />
              <div
                ref={tailViewportRef}
                className="w-full overflow-auto"
                style={{ height: `${tailHeight}px` }}
                onScroll={handleTailScroll}
              >
                <pre className="min-h-full px-3 py-2 font-mono text-xs leading-5 text-foreground/90 whitespace-pre-wrap wrap-break-word">
                  {tailLines.length > 0
                    ? tailLines.join("\n")
                    : tailStatus === "connecting"
                      ? "Starting tail session..."
                      : "Waiting for fresh log lines..."}
                </pre>
              </div>
            </div>
          ) : (
            <div className="border border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
              Tail is idle. Open it when you want a streaming view without
              reloading the snapshot table.
            </div>
          )}
        </div>
      </AccordionSection>

      <AccordionSection
        title="Snapshot"
        description="Current LogOutput.log state with filters applied to the table below."
        isOpen={openSection === "snapshot"}
        onToggle={() =>
          setOpenSection((current) =>
            current === "snapshot" ? null : "snapshot",
          )
        }
        headerContent={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {snapshot
                ? `${filteredLines.length}/${snapshot.totalLines} rows`
                : loadingSnapshot
                  ? "Loading..."
                  : "No data"}
            </span>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="space-y-4 border border-border/70 bg-background/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void loadSnapshot()}
              >
                <ArrowsClockwise size={14} />
                Reload Table
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Search
                </span>
                <div className="relative">
                  <MagnifyingGlass
                    size={14}
                    className="pointer-events-none absolute top-2.5 left-2.5 text-muted-foreground"
                  />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search messages, mod names, file paths, or sources"
                    className="pl-8"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Source
                </span>
                <Select
                  value={sourceFilter}
                  onValueChange={(value) => setSourceFilter(value ?? "all")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All sources ({searchFilteredLines.length})
                    </SelectItem>
                    {sourceOptions.map(([source, count]) => (
                      <SelectItem key={source} value={source}>
                        {formatSourceLabel(source)} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Level
              </p>
              <div className="flex flex-wrap gap-2">
                <CountFilterButton
                  active={levelFilter === "all"}
                  label="all"
                  count={sourceAwareLines.length}
                  onClick={() => setLevelFilter("all")}
                />
                {Array.from(levelCounts.entries()).map(([level, count]) => (
                  <CountFilterButton
                    key={level}
                    active={levelFilter === level}
                    label={level}
                    count={count}
                    onClick={() => setLevelFilter(level)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {snapshot?.path || "Loading log path..."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
              <span>
                Showing {filteredLines.length} of {lines.length} lines
              </span>
              <span>
                Search: {searchNeedle ? "active" : "off"} | Source:{" "}
                {formatSourceLabel(sourceFilter)} | Level: {levelFilter}
              </span>
            </div>
          </div>

          <Separator />

          {snapshotError && (
            <div className="border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Failed to load log snapshot: {snapshotError}
            </div>
          )}

          {loadingSnapshot && !snapshot && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading log snapshot...
            </div>
          )}

          {!loadingSnapshot && snapshot && (
            <ScrollArea className="h-168 min-h-0 flex-1 border border-border/70 bg-background/50">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10 bg-card/95 text-left">
                  <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-20 border-b border-border/70 px-3 py-2 font-medium">
                      Line
                    </th>
                    <th className="w-32 border-b border-border/70 px-3 py-2 font-medium">
                      Level
                    </th>
                    <th className="w-48 border-b border-border/70 px-3 py-2 font-medium">
                      Source
                    </th>
                    <th className="border-b border-border/70 px-3 py-2 font-medium">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => (
                    <tr
                      key={line.lineNumber}
                      className="align-top odd:bg-muted/10"
                    >
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
        </div>
      </AccordionSection>
    </div>
  );
}

function AccordionSection({
  title,
  description,
  isOpen,
  onToggle,
  headerContent,
  children,
}: {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="border border-border/80 bg-card/80">
        <CardHeader className="gap-3 border-b border-border/70">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {headerContent}
              <CollapsibleTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  />
                }
              >
                {isOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}
                {isOpen ? "Collapse" : "Expand"}
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CountFilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border px-2.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border/70 bg-background/40 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

function makeCountEntries<T>(items: T[], keyFn: (item: T) => string) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Map(
    Array.from(counts.entries()).sort((left, right) => {
      const leftRank = getLevelSortRank(left[0]);
      const rightRank = getLevelSortRank(right[0]);
      if (leftRank !== rightRank) return leftRank - rightRank;

      const countDiff = right[1] - left[1];
      if (countDiff !== 0) return countDiff;

      return left[0].localeCompare(right[0]);
    }),
  );
}

function getLevelKey(level: string) {
  return level.trim().toLowerCase() || "raw";
}

function getSourceKey(source: string) {
  return source.trim() || "(none)";
}

function formatSourceLabel(source: string) {
  return source === "all" ? "all" : source;
}

function getLevelSortRank(level: string) {
  if (level === "message") return 0;
  if (level === "info") return 1;
  if (level === "warning") return 2;
  if (level === "error") return 3;
  if (level === "raw") return 4;
  return 5;
}

function getIsNearBottom(element: HTMLDivElement) {
  const remaining =
    element.scrollHeight - element.scrollTop - element.clientHeight;
  return remaining <= TAIL_BOTTOM_THRESHOLD_PX;
}

function LevelBadge({ level }: { level: string }) {
  const normalizedLevel = level.trim().toLowerCase();

  if (!normalizedLevel) {
    return <Badge variant="outline">raw</Badge>;
  }

  if (normalizedLevel.startsWith("message")) {
    return <Badge variant="secondary">{level.trim()}</Badge>;
  }

  if (normalizedLevel.startsWith("error")) {
    return <Badge variant="destructive">{level.trim()}</Badge>;
  }

  if (normalizedLevel.startsWith("warning")) {
    return (
      <Badge variant="secondary" className="bg-amber-500/15 text-amber-300">
        {level.trim()}
      </Badge>
    );
  }

  if (normalizedLevel.startsWith("info")) {
    return <Badge variant="outline">{level.trim()}</Badge>;
  }

  return <Badge variant="outline">{level.trim()}</Badge>;
}

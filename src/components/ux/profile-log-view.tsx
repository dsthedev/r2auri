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
import type {
  SmartPatternId,
  SmartPatternMetadata,
} from "@/types/smart-patterns";
import { DEFAULT_SMART_PATTERNS, mergePatterns } from "@/types/smart-patterns";
import { useSettings } from "@/hooks/use-settings";
import { ProfileLogTable } from "./profile-log-table";
import { QuickAddPattern } from "./quick-add-pattern";

const MIN_TAIL_HEIGHT = 180;
const MAX_TAIL_HEIGHT = 420;
const DEFAULT_TAIL_HEIGHT = 220;
const MAX_TAIL_LINES = 500;
const TAIL_AUTO_SCROLL_PAUSE_MS = 4000;
const TAIL_BOTTOM_THRESHOLD_PX = 24;

type LogSection = "tail" | "snapshot" | null;

interface SmartPatternCard {
  id: SmartPatternId;
  title: string;
  description: string;
  count: number;
  firstLineNumber: number;
  example: string;
}

interface LogFilterState {
  sourceFilter: string;
  searchQuery: string;
  focusedLevel: string | null;
  hiddenLevels: string[];
  hiddenPatternIds: SmartPatternId[];
  focusedPatternId: SmartPatternId | null;
}

export function ProfileLogView({
  modsPath,
  profile,
}: {
  modsPath: string;
  profile: string;
}) {
  const { settings, updateSettings } = useSettings();
  const [snapshot, setSnapshot] = useState<ProfileLogSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<LogSection>("snapshot");
  const [patternsExpanded, setPatternsExpanded] = useState(false);
  const [tailEnabled, setTailEnabled] = useState(false);
  const [tailHeight, setTailHeight] = useState(DEFAULT_TAIL_HEIGHT);
  const [tailLines, setTailLines] = useState<string[]>([]);
  const [tailStatus, setTailStatus] = useState<
    "idle" | "connecting" | "running" | "stopped"
  >("idle");
  const [tailError, setTailError] = useState<string | null>(null);
  const [tailShell, setTailShell] = useState("");
  const [tailCommand, setTailCommand] = useState("");
  const [filterState, setFilterState] = useState<LogFilterState>(
    createDefaultFilterState(),
  );
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false);

  const tailSessionIdRef = useRef<string | null>(null);
  const tailPollInFlightRef = useRef(false);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const tailViewportRef = useRef<HTMLDivElement | null>(null);
  const tailAutoScrollPauseUntilRef = useRef(0);

  // Compute patterns early so they can be used in useEffects
  const allPatterns = useMemo((): SmartPatternMetadata[] => {
    const customPatterns = settings?.custom_smart_patterns ?? [];
    return mergePatterns(DEFAULT_SMART_PATTERNS, customPatterns);
  }, [settings?.custom_smart_patterns]);

  // Build dynamic pattern ID set including custom patterns for validation
  const validPatternIdSet = useMemo(() => {
    const allPatternIds = allPatterns.map((p) => p.id);
    return new Set<SmartPatternId>(allPatternIds);
  }, [allPatterns]);

  const filterStorageKey = useMemo(
    () => getLogFilterStorageKey(modsPath, profile),
    [modsPath, profile],
  );

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
    setAutoReloadEnabled(false);
    setFilterState(loadFilterState(filterStorageKey, validPatternIdSet));
    void stopTailSession();
    void loadSnapshot();
  }, [modsPath, profile, filterStorageKey, validPatternIdSet]);

  useEffect(() => {
    saveFilterState(filterStorageKey, filterState);
  }, [filterStorageKey, filterState]);

  useEffect(() => {
    if (!autoReloadEnabled) return;

    let intervalId: number | null = null;

    const startAutoReload = () => {
      intervalId = window.setInterval(() => {
        void loadSnapshot();
      }, 5000);
    };

    startAutoReload();

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [autoReloadEnabled]);

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

  const searchNeedle = filterState.searchQuery.trim().toLowerCase();

  const lines = snapshot?.lines ?? [];

  const smartPatternAnalysis = useMemo(
    () => analyzeSmartPatterns(lines, allPatterns),
    [lines, allPatterns],
  );

  const patternFilteredLines = useMemo(() => {
    const focusedPatternId = filterState.focusedPatternId;

    if (focusedPatternId) {
      return lines.filter((line) =>
        smartPatternAnalysis.linePatternMap
          .get(line.lineNumber)
          ?.has(focusedPatternId),
      );
    }

    if (filterState.hiddenPatternIds.length === 0) return lines;

    return lines.filter((line) => {
      const patternIds = smartPatternAnalysis.linePatternMap.get(
        line.lineNumber,
      );
      if (!patternIds) return true;

      return !filterState.hiddenPatternIds.some((patternId) =>
        patternIds.has(patternId),
      );
    });
  }, [
    filterState.focusedPatternId,
    filterState.hiddenPatternIds,
    lines,
    smartPatternAnalysis.linePatternMap,
  ]);

  const searchFilteredLines = useMemo(() => {
    if (!searchNeedle) return patternFilteredLines;

    return patternFilteredLines.filter((line) => {
      const blob = `${line.raw}\n${line.source}\n${line.message}`.toLowerCase();
      return blob.includes(searchNeedle);
    });
  }, [patternFilteredLines, searchNeedle]);

  const sourceAwareLines = useMemo(() => {
    if (filterState.sourceFilter === "all") return searchFilteredLines;
    return searchFilteredLines.filter(
      (line) => getSourceKey(line.source) === filterState.sourceFilter,
    );
  }, [searchFilteredLines, filterState.sourceFilter]);

  const levelSmartLines = useMemo(() => {
    let next = searchFilteredLines;

    if (filterState.focusedLevel) {
      next = next.filter(
        (line) => getLevelKey(line.level) === filterState.focusedLevel,
      );
    }

    if (filterState.hiddenLevels.length > 0) {
      next = next.filter(
        (line) => !filterState.hiddenLevels.includes(getLevelKey(line.level)),
      );
    }

    return next;
  }, [searchFilteredLines, filterState.focusedLevel, filterState.hiddenLevels]);

  const filteredLines = useMemo(() => {
    if (filterState.sourceFilter === "all") return levelSmartLines;
    return levelSmartLines.filter(
      (line) => getSourceKey(line.source) === filterState.sourceFilter,
    );
  }, [levelSmartLines, filterState.sourceFilter]);

  const levelCounts = useMemo(
    () => makeCountEntries(sourceAwareLines, (line) => getLevelKey(line.level)),
    [sourceAwareLines],
  );
  const sourceCounts = useMemo(
    () =>
      makeCountEntries(levelSmartLines, (line) => getSourceKey(line.source)),
    [levelSmartLines],
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

  const toggleHiddenPattern = (patternId: SmartPatternId) => {
    setFilterState((current) => ({
      ...current,
      focusedPatternId:
        current.focusedPatternId === patternId
          ? null
          : current.focusedPatternId,
      hiddenPatternIds: current.hiddenPatternIds.includes(patternId)
        ? current.hiddenPatternIds.filter((id) => id !== patternId)
        : [...current.hiddenPatternIds, patternId],
    }));
  };

  const focusPattern = (patternId: SmartPatternId) => {
    setFilterState((current) => ({
      ...current,
      hiddenPatternIds: current.hiddenPatternIds.filter(
        (id) => id !== patternId,
      ),
      focusedPatternId:
        current.focusedPatternId === patternId ? null : patternId,
    }));
  };

  const clearSmartFilters = () => {
    setFilterState((current) => ({
      ...current,
      hiddenPatternIds: [],
      focusedPatternId: null,
      focusedLevel: null,
      hiddenLevels: [],
    }));
  };

  const hideAllSmartPatterns = () => {
    setFilterState((current) => ({
      ...current,
      focusedPatternId: null,
      hiddenPatternIds: smartPatternAnalysis.patterns.map(
        (pattern) => pattern.id,
      ),
    }));
  };

  const cycleLevelFilter = (level: string) => {
    setFilterState((current) => {
      if (current.focusedLevel === level) {
        return {
          ...current,
          focusedLevel: null,
          hiddenLevels: current.hiddenLevels.includes(level)
            ? current.hiddenLevels
            : [...current.hiddenLevels, level],
        };
      }

      if (current.hiddenLevels.includes(level)) {
        return {
          ...current,
          hiddenLevels: current.hiddenLevels.filter((item) => item !== level),
        };
      }

      return {
        ...current,
        focusedLevel: level,
      };
    });
  };

  const clearLevelSmartFilters = () => {
    setFilterState((current) => ({
      ...current,
      focusedLevel: null,
      hiddenLevels: [],
    }));
  };

  const handleAddCustomPattern = async (pattern: SmartPatternMetadata) => {
    if (!settings) return;

    const updatedPatterns = [
      ...(settings.custom_smart_patterns ?? []),
      pattern,
    ];
    const updatedSettings = {
      ...settings,
      custom_smart_patterns: updatedPatterns,
    };

    try {
      await updateSettings(updatedSettings);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to add custom pattern:", message);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
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
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Smart Patterns
                </p>
                <p className="text-sm text-muted-foreground">
                  Repeated noise candidates detected from this log. Hide them to
                  reduce junk, or focus one to inspect it directly.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
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
                <Button
                  type="button"
                  size="sm"
                  className={`gap-1.5 ${
                    autoReloadEnabled
                      ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                      : "variant-outline"
                  }`}
                  variant={autoReloadEnabled ? undefined : "outline"}
                  onClick={() => setAutoReloadEnabled((current) => !current)}
                >
                  <Pulse size={14} weight="fill" />
                  {autoReloadEnabled ? "Live Reload: ON" : "Live Reload: OFF"}
                </Button>
                {(filterState.hiddenPatternIds.length > 0 ||
                  filterState.focusedPatternId) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSmartFilters}
                  >
                    Clear Smart Filters
                  </Button>
                )}
                {smartPatternAnalysis.patterns.length > 0 &&
                  filterState.hiddenPatternIds.length <
                    smartPatternAnalysis.patterns.length && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={hideAllSmartPatterns}
                    >
                      Hide All
                    </Button>
                  )}
              </div>
            </div>

            {smartPatternAnalysis.patterns.length > 0 && (
              <Collapsible
                open={patternsExpanded}
                onOpenChange={setPatternsExpanded}
              >
                <CollapsibleTrigger className="flex items-center gap-2 py-2 text-sm font-medium text-foreground hover:text-primary w-full">
                  {patternsExpanded ? (
                    <CaretDown size={16} />
                  ) : (
                    <CaretRight size={16} />
                  )}
                  View {smartPatternAnalysis.patterns.length} Pattern
                  {smartPatternAnalysis.patterns.length !== 1 ? "s" : ""}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-3 xl:grid-cols-2 mt-3">
                    {smartPatternAnalysis.patterns.map((pattern) => {
                      const isHidden = filterState.hiddenPatternIds.includes(
                        pattern.id,
                      );
                      const isFocused =
                        filterState.focusedPatternId === pattern.id;

                      return (
                        <div
                          key={pattern.id}
                          className={`border p-3 transition-colors ${
                            isFocused
                              ? "border-primary bg-primary/10"
                              : isHidden
                                ? "border-border/70 bg-background/30 opacity-75"
                                : "border-border/70 bg-background/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">
                                  {pattern.title}
                                </p>
                                <Badge variant="outline">
                                  {pattern.count} lines
                                </Badge>
                                {isFocused && <Badge>focused</Badge>}
                                {isHidden && (
                                  <Badge variant="secondary">hidden</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {pattern.description}
                              </p>
                            </div>

                            <div className="flex shrink-0 gap-2">
                              <Button
                                type="button"
                                variant={isFocused ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => focusPattern(pattern.id)}
                              >
                                {isFocused ? "Show All" : "Only Show"}
                              </Button>
                              <Button
                                type="button"
                                variant={isHidden ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => toggleHiddenPattern(pattern.id)}
                              >
                                {isHidden ? "Unhide" : "Hide"}
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3 border border-border/60 bg-background/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                            [L{pattern.firstLineNumber}] {pattern.example}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

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
                    value={filterState.searchQuery}
                    onChange={(event) =>
                      setFilterState((current) => ({
                        ...current,
                        searchQuery: event.target.value,
                      }))
                    }
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
                  value={filterState.sourceFilter}
                  onValueChange={(value) =>
                    setFilterState((current) => ({
                      ...current,
                      sourceFilter: value ?? "all",
                    }))
                  }
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
              <div className="flex flex-wrap items-center gap-2">
                {Array.from(levelCounts.entries()).map(([level, count]) => (
                  <LevelSmartFilterButton
                    key={level}
                    mode={
                      filterState.focusedLevel === level
                        ? "focused"
                        : filterState.hiddenLevels.includes(level)
                          ? "hidden"
                          : "default"
                    }
                    label={level}
                    count={count}
                    onClick={() => cycleLevelFilter(level)}
                  />
                ))}
                {(filterState.focusedLevel !== null ||
                  filterState.hiddenLevels.length > 0) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearLevelSmartFilters}
                  >
                    Show All Levels
                  </Button>
                )}
              </div>
            </div>

            {(filterState.hiddenPatternIds.length > 0 ||
              filterState.focusedPatternId ||
              filterState.focusedLevel !== null ||
              filterState.hiddenLevels.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 border border-border/70 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                <span>Smart filters:</span>
                {filterState.focusedPatternId && (
                  <Badge>
                    focused {formatPatternLabel(filterState.focusedPatternId)}
                  </Badge>
                )}
                {filterState.hiddenPatternIds.map((patternId) => (
                  <Badge key={patternId} variant="outline">
                    hidden {formatPatternLabel(patternId)}
                  </Badge>
                ))}
                {filterState.focusedLevel && (
                  <Badge>focused level {filterState.focusedLevel}</Badge>
                )}
                {filterState.hiddenLevels.map((level) => (
                  <Badge key={level} variant="outline">
                    hidden level {level}
                  </Badge>
                ))}
              </div>
            )}
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
                {formatSourceLabel(filterState.sourceFilter)} | Levels:{" "}
                {formatLevelSmartState(
                  filterState.focusedLevel,
                  filterState.hiddenLevels,
                )}
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
            <div
              className="border border-border/70 bg-background/50 overflow-hidden"
              style={{ height: "50vh", maxHeight: "50vh" }}
            >
              <ProfileLogTable lines={filteredLines} />
            </div>
          )}

          {!loadingSnapshot && snapshot && (
            <div className="pt-4">
              <QuickAddPattern onAddPattern={handleAddCustomPattern} />
            </div>
          )}
        </div>
      </AccordionSection>
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

function LevelSmartFilterButton({
  mode,
  label,
  count,
  onClick,
}: {
  mode: "default" | "focused" | "hidden";
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border px-2.5 py-1.5 text-sm transition-colors ${
        mode === "focused"
          ? "border-primary bg-primary/10 text-foreground"
          : mode === "hidden"
            ? "border-border/70 bg-background/20 text-muted-foreground line-through opacity-80"
            : "border-border/70 bg-background/40 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{count}</span>
      {mode === "focused" && (
        <span className="text-[10px] uppercase tracking-wide">focus</span>
      )}
      {mode === "hidden" && (
        <span className="text-[10px] uppercase tracking-wide">hide</span>
      )}
    </button>
  );
}

function analyzeSmartPatterns(
  lines: ProfileLogSnapshot["lines"],
  patterns: SmartPatternMetadata[],
) {
  const linePatternMap = new Map<number, Set<SmartPatternId>>();

  const addMatch = (lineNumber: number, patternId: SmartPatternId) => {
    const current = linePatternMap.get(lineNumber) ?? new Set<SmartPatternId>();
    current.add(patternId);
    linePatternMap.set(lineNumber, current);
  };

  let inSaveDataDump = false;

  for (const line of lines) {
    const raw = line.raw;
    const message = line.message || line.raw;
    const source = getSourceKey(line.source);

    // Built-in default pattern logic
    if (
      message.includes("All files in local storage save data:") ||
      message.includes("All files in platform save data:")
    ) {
      inSaveDataDump = true;
      addMatch(line.lineNumber, "save-data-dump");
    } else if (inSaveDataDump) {
      if (raw.startsWith("[")) {
        inSaveDataDump = false;
      } else if (raw.trim()) {
        addMatch(line.lineNumber, "save-data-dump");
        continue;
      }
    }

    if (source === "HookGenPatcher") {
      if (
        message.includes("Previous MMHOOK location found") ||
        message.includes("Already ran for this version")
      ) {
        addMatch(line.lineNumber, "hookgen-reuse");
      }
    }

    if (
      message.includes(
        "Desired shader compiler platform 18 is not available in shader blob",
      )
    ) {
      addMatch(line.lineNumber, "shader-compiler-spam");
    }

    if (source === "BepInEx" && message.startsWith("Loading [")) {
      addMatch(line.lineNumber, "plugin-loading");
    }

    if (source === "Jotunn.Main" && message.startsWith("Initializing ")) {
      addMatch(line.lineNumber, "jotunn-init");
    }

    if (
      source === "Unity Log" &&
      /Loaded localization file #\d+/.test(message)
    ) {
      addMatch(line.lineNumber, "unity-localization-flood");
    }

    if (
      source === "StarLevelSystem" &&
      ((message.startsWith("Reading ") &&
        message.includes("/localizations/")) ||
        message.startsWith("Added localization:"))
    ) {
      addMatch(line.lineNumber, "starlevel-localization-scan");
    }

    // Custom pattern regex matching
    for (const pattern of patterns) {
      if (pattern.isDefault || !pattern.pattern) continue; // Skip defaults and patterns without regex
      try {
        const regex = new RegExp(pattern.pattern);
        const testContent = `${message}\n${source}`;
        if (regex.test(testContent)) {
          addMatch(line.lineNumber, pattern.id);
        }
      } catch (e) {
        // Skip invalid regex patterns
      }
    }
  }

  const patternCards = patterns.flatMap((pattern) => {
    if (!pattern.enabled) return [];
    const matchedLines = lines.filter((line) =>
      linePatternMap.get(line.lineNumber)?.has(pattern.id),
    );

    if (matchedLines.length < pattern.minLinesToShow) {
      return [];
    }

    const exampleLine = matchedLines[0];
    return [
      {
        id: pattern.id,
        title: pattern.title,
        description: pattern.description,
        count: matchedLines.length,
        firstLineNumber: exampleLine.lineNumber,
        example: truncateForCard(exampleLine.message || exampleLine.raw),
      } satisfies SmartPatternCard,
    ];
  });

  return { patterns: patternCards, linePatternMap };
}

const SMART_PATTERN_ID_SET = new Set<SmartPatternId>(
  DEFAULT_SMART_PATTERNS.map((pattern) => pattern.id),
);

function truncateForCard(text: string) {
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function formatPatternLabel(patternId: SmartPatternId) {
  return (
    DEFAULT_SMART_PATTERNS.find((pattern) => pattern.id === patternId)?.title ??
    patternId
  );
}

function formatLevelSmartState(
  focusedLevel: string | null,
  hiddenLevels: string[],
) {
  if (focusedLevel) return `focused(${focusedLevel})`;
  if (hiddenLevels.length > 0) return `hidden(${hiddenLevels.join(",")})`;
  return "all";
}

function createDefaultFilterState(): LogFilterState {
  return {
    sourceFilter: "all",
    searchQuery: "",
    focusedLevel: null,
    hiddenLevels: [],
    hiddenPatternIds: [],
    focusedPatternId: null,
  };
}

function getLogFilterStorageKey(modsPath: string, profile: string) {
  return `r2auri:log-filter-state:${modsPath}:${profile}`;
}

function loadFilterState(
  storageKey: string,
  validPatternIdSet?: Set<SmartPatternId>,
): LogFilterState {
  const fallback = createDefaultFilterState();

  if (typeof window === "undefined") {
    return fallback;
  }

  // Default to only default patterns if no valid set provided
  const patternIdSet = validPatternIdSet || SMART_PATTERN_ID_SET;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<LogFilterState>;
    const sourceFilter =
      typeof parsed.sourceFilter === "string" && parsed.sourceFilter.trim()
        ? parsed.sourceFilter
        : "all";
    const searchQuery =
      typeof parsed.searchQuery === "string" ? parsed.searchQuery : "";
    const focusedLevel =
      typeof parsed.focusedLevel === "string" && parsed.focusedLevel.trim()
        ? parsed.focusedLevel
        : null;
    const hiddenLevels = Array.isArray(parsed.hiddenLevels)
      ? parsed.hiddenLevels.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const hiddenPatternIds = Array.isArray(parsed.hiddenPatternIds)
      ? parsed.hiddenPatternIds.filter(
          (value): value is SmartPatternId =>
            typeof value === "string" &&
            patternIdSet.has(value as SmartPatternId),
        )
      : [];
    const focusedPatternId =
      typeof parsed.focusedPatternId === "string" &&
      patternIdSet.has(parsed.focusedPatternId as SmartPatternId)
        ? (parsed.focusedPatternId as SmartPatternId)
        : null;

    return {
      sourceFilter,
      searchQuery,
      focusedLevel,
      hiddenLevels: [...new Set(hiddenLevels)],
      hiddenPatternIds: [...new Set(hiddenPatternIds)],
      focusedPatternId,
    };
  } catch {
    return fallback;
  }
}

function saveFilterState(storageKey: string, filterState: LogFilterState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(filterState));
  } catch {
    return;
  }
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

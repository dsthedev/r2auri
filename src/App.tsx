import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CaretDownIcon,
  CaretUpIcon,
  ArrowSquareOutIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

// ── Types ──────────────────────────────────────────────────────────────────

interface VersionNumber {
  major: number;
  minor: number;
  patch: number;
}

interface ModEntry {
  name: string;
  authorName: string;
  displayName: string;
  description: string;
  websiteUrl: string;
  versionNumber: VersionNumber;
  enabled: boolean;
  dependencies: string[];
  networkMode: string;
  packageType: string;
  installedAtTime: number | null;
  icon: string | null;
}

type FilterMode = "all" | "enabled" | "disabled";
type SortMode = "name" | "author" | "version";

const versionStr = (v: VersionNumber) => `${v.major}.${v.minor}.${v.patch}`;

// ── ModCard ────────────────────────────────────────────────────────────────

function ModCard({
  mod,
  selected,
  onSelect,
}: {
  mod: ModEntry;
  selected?: boolean;
  onSelect?: (mod: ModEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card
        className={cn(
          "ring-0 border border-border py-0 gap-0 rounded-md",
          selected && "border-primary/70 bg-muted/20",
          !mod.enabled && "opacity-50"
        )}
      >
        <CollapsibleTrigger
          onClick={() => onSelect?.(mod)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/30 transition-colors cursor-pointer rounded-none"
        >
          <div className="size-8 shrink-0 overflow-hidden rounded">
            {mod.icon ? (
              <img src={mod.icon} alt="" className="size-8 object-cover" />
            ) : (
              <div className="size-8 bg-muted flex items-center justify-center text-muted-foreground text-xs rounded">
                ?
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{mod.displayName}</div>
            <div className="text-[10px] text-muted-foreground">{mod.authorName}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground font-mono">
              v{versionStr(mod.versionNumber)}
            </span>
            <Badge
              variant={mod.enabled ? "default" : "secondary"}
              className="text-[10px] px-1.5 h-4 leading-none"
            >
              {mod.enabled ? "on" : "off"}
            </Badge>
            {open ? (
              <CaretUpIcon className="size-3 text-muted-foreground" />
            ) : (
              <CaretDownIcon className="size-3 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="px-3 py-2.5 space-y-2">
            {mod.description && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {mod.description}
              </p>
            )}
            {mod.dependencies.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-foreground/80">
                  Dependencies
                </p>
                <div className="flex flex-wrap gap-1">
                  {mod.dependencies.map((d) => (
                    <Badge
                      key={d}
                      variant="outline"
                      className="text-[9px] font-mono px-1.5 h-4 leading-none"
                    >
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <button
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                openUrl(mod.websiteUrl);
              }}
            >
              <ArrowSquareOutIcon className="size-3" />
              View on Thunderstore
            </button>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ── ProfileView ────────────────────────────────────────────────────────────

function ProfileView({ profiles }: { profiles: string[] }) {
  const [selectedProfile, setSelectedProfile] = useState<string>(profiles[0] ?? "");
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [selectedMod, setSelectedMod] = useState<ModEntry | null>(null);
  const [readmeContent, setReadmeContent] = useState("");
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [readmeError, setReadmeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("name");

  useEffect(() => {
    if (!selectedProfile) return;
    setSelectedMod(null);
    setLoading(true);
    setError(null);
    invoke<ModEntry[]>("get_profile_mods", { profile: selectedProfile })
      .then(setMods)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selectedProfile]);

  useEffect(() => {
    setReadmeLoading(true);
    setReadmeError(null);
    invoke<string>("get_app_readme")
      .then((content) => setReadmeContent(content))
      .catch((e) => {
        setReadmeError(String(e));
        setReadmeContent("");
      })
      .finally(() => setReadmeLoading(false));
  }, [selectedProfile]);

  const handleSelectMod = (mod: ModEntry) => {
    setSelectedMod(mod);
    setReadmeLoading(true);
    setReadmeError(null);
    invoke<string>("get_mod_readme", { profile: selectedProfile, modName: mod.name })
      .then((content) => setReadmeContent(content))
      .catch((e) => {
        setReadmeError(String(e));
        setReadmeContent("");
      })
      .finally(() => setReadmeLoading(false));
  };

  const filtered = useMemo(() => {
    let result = [...mods];
    if (filter === "enabled") result = result.filter((m) => m.enabled);
    if (filter === "disabled") result = result.filter((m) => !m.enabled);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.authorName.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      if (sort === "author") return a.authorName.localeCompare(b.authorName);
      if (sort === "version")
        return versionStr(b.versionNumber).localeCompare(versionStr(a.versionNumber));
      return 0;
    });
    return result;
  }, [mods, filter, search, sort]);

  const enabledCount = mods.filter((m) => m.enabled).length;

  return (
    <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="flex flex-col gap-3 min-h-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Profile
            </span>
            <Select
              value={selectedProfile}
              onValueChange={(v) => v && setSelectedProfile(v)}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mods.length > 0 && (
            <div className="flex gap-3 text-xs">
              <span className="text-foreground">{mods.length} mods</span>
              <span className="text-green-400">{enabledCount} enabled</span>
              <span className="text-muted-foreground">
                {mods.length - enabledCount} disabled
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-6"
              placeholder="Search mods…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={(v) => v && setFilter(v as FilterMode)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => v && setSort(v as SortMode)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="author">Author</SelectItem>
              <SelectItem value="version">Version</SelectItem>
            </SelectContent>
          </Select>
          {search && (
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        )}
        {error && (
          <Card className="ring-0 border border-destructive text-destructive px-3 py-2 text-xs">
            {error}
          </Card>
        )}
        {!loading && !error && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col gap-1 pb-4">
              {filtered.map((mod) => (
                <ModCard
                  key={mod.name}
                  mod={mod}
                  selected={selectedMod?.name === mod.name}
                  onSelect={handleSelectMod}
                />
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No mods match your filters.
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <Card className="ring-0 border border-border rounded-md py-0 gap-0 min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs font-semibold">
            {selectedMod ? `${selectedMod.displayName} README` : "r2auri README"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {selectedMod ? `Source: ${selectedProfile}` : "Default app documentation"}
          </p>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 py-2.5">
            {readmeLoading && (
              <p className="text-xs text-muted-foreground">Loading README…</p>
            )}
            {!readmeLoading && readmeError && (
              <p className="text-xs text-destructive">{readmeError}</p>
            )}
            {!readmeLoading && !readmeError && (
              <div className="text-xs text-foreground leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-sm font-semibold mt-4 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xs font-semibold mt-3 mb-1.5">{children}</h3>
                    ),
                    p: ({ children }) => <p className="mb-2">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children }) => (
                      <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-muted/60 border border-border rounded-md p-2 overflow-x-auto mb-2">
                        {children}
                      </pre>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-border pl-3 text-muted-foreground mb-2">
                        {children}
                      </blockquote>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-2">
                        <table className="w-full border-collapse text-[11px]">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border px-2 py-1 text-left bg-muted/50">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-2 py-1">{children}</td>
                    ),
                  }}
                >
                  {readmeContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

// ── CompareSection ─────────────────────────────────────────────────────────

function CompareSection({
  title,
  mods,
  accentClass,
  bVersions,
}: {
  title: string;
  mods: ModEntry[];
  accentClass: string;
  bVersions?: Map<string, string>;
}) {
  if (mods.length === 0) return null;
  return (
    <Card className={cn("ring-0 border border-border border-t-2 overflow-hidden py-0 gap-0 rounded-md", accentClass)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold">{title}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 leading-none">
          {mods.length}
        </Badge>
      </div>
      <ScrollArea className="max-h-72">
        <div className="flex flex-col divide-y divide-border">
          {mods.map((mod) => (
            <div key={mod.name} className="flex items-center gap-2 px-3 py-1.5">
              {mod.icon && (
                <img src={mod.icon} alt="" className="size-5 rounded object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block">{mod.displayName}</span>
                <span className="text-[10px] text-muted-foreground">{mod.authorName}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono text-muted-foreground">
                {bVersions ? (
                  <>
                    <span className="text-blue-400">v{versionStr(mod.versionNumber)}</span>
                    <span>→</span>
                    <span className="text-orange-400">v{bVersions.get(mod.name)}</span>
                  </>
                ) : (
                  <span>v{versionStr(mod.versionNumber)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ── ProfileCompare ─────────────────────────────────────────────────────────

function ProfileCompare({ profiles }: { profiles: string[] }) {
  const [profileA, setProfileA] = useState<string>(profiles[0] ?? "");
  const [profileB, setProfileB] = useState<string>(profiles[1] ?? profiles[0] ?? "");
  const [modsA, setModsA] = useState<ModEntry[]>([]);
  const [modsB, setModsB] = useState<ModEntry[]>([]);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  useEffect(() => {
    if (!profileA) return;
    setLoadingA(true);
    invoke<ModEntry[]>("get_profile_mods", { profile: profileA })
      .then(setModsA)
      .catch(console.error)
      .finally(() => setLoadingA(false));
  }, [profileA]);

  useEffect(() => {
    if (!profileB) return;
    setLoadingB(true);
    invoke<ModEntry[]>("get_profile_mods", { profile: profileB })
      .then(setModsB)
      .catch(console.error)
      .finally(() => setLoadingB(false));
  }, [profileB]);

  const cmp = useMemo(() => {
    const mapA = new Map(modsA.map((m) => [m.name, m]));
    const mapB = new Map(modsB.map((m) => [m.name, m]));
    const onlyInA = modsA.filter((m) => !mapB.has(m.name));
    const onlyInB = modsB.filter((m) => !mapA.has(m.name));
    const inBoth = modsA.filter((m) => mapB.has(m.name));
    const diffs = inBoth.filter(
      (m) => versionStr(m.versionNumber) !== versionStr(mapB.get(m.name)!.versionNumber)
    );
    const bVersionsForDiffs = new Map(
      diffs.map((m) => [m.name, versionStr(mapB.get(m.name)!.versionNumber)])
    );
    const same = inBoth.filter(
      (m) =>
        versionStr(m.versionNumber) === versionStr(mapB.get(m.name)!.versionNumber)
    );
    return { onlyInA, onlyInB, diffs, bVersionsForDiffs, same };
  }, [modsA, modsB]);

  const loading = loadingA || loadingB;
  const ready = modsA.length > 0 || modsB.length > 0;

  const statItems = [
    { label: "mods in A", value: modsA.length, color: "" },
    { label: "mods in B", value: modsB.length, color: "" },
    { label: "only in A", value: cmp.onlyInA.length, color: "text-blue-400" },
    { label: "only in B", value: cmp.onlyInB.length, color: "text-orange-400" },
    { label: "ver. diffs", value: cmp.diffs.length, color: "text-primary" },
    { label: "identical", value: cmp.same.length, color: "text-green-400" },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Profile selectors */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide">
            Profile A
          </span>
          <Select value={profileA} onValueChange={(v) => v && setProfileA(v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground text-base">⟷</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-orange-400 uppercase tracking-wide">
            Profile B
          </span>
          <Select value={profileB} onValueChange={(v) => v && setProfileB(v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      )}

      {!loading && ready && (
        <ScrollArea className="flex-1">
          <div className="space-y-3 pb-4">
            {/* Stats row */}
            <div className="flex gap-2 flex-wrap">
              {statItems.map(({ label, value, color }) => (
                <Card
                  key={label}
                  className="ring-0 border border-border py-2 gap-0.5 px-4 min-w-[72px] items-center rounded-md"
                >
                  <span className={cn("text-xl font-bold leading-none", color || "text-foreground")}>
                    {value}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {label}
                  </span>
                </Card>
              ))}
            </div>

            <Separator />

            {/* Compare sections */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <CompareSection
                title={`Only in ${profileA}`}
                mods={cmp.onlyInA}
                accentClass="border-t-blue-500"
              />
              <CompareSection
                title={`Only in ${profileB}`}
                mods={cmp.onlyInB}
                accentClass="border-t-orange-500"
              />
              <CompareSection
                title="Version differences"
                mods={cmp.diffs}
                accentClass="border-t-primary"
                bVersions={cmp.bVersionsForDiffs}
              />
            </div>

            {cmp.same.length > 0 && (
              <details className="group">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1 select-none">
                  ▶ Common mods ({cmp.same.length} identical)
                </summary>
                <div className="mt-2">
                  <CompareSection
                    title="Identical in both"
                    mods={cmp.same}
                    accentClass="border-t-green-500"
                  />
                </div>
              </details>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<string[]>("list_profiles")
      .then(setProfiles)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-card shrink-0">
        <span className="text-base font-bold text-primary tracking-tight">⚔ r2auri</span>
        <span className="text-[11px] text-muted-foreground">Valheim Mod Profile Viewer</span>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-hidden px-5 py-3 flex flex-col max-w-5xl w-full mx-auto">
        {error && (
          <Card className="ring-0 border border-destructive text-destructive text-xs px-3 py-2 mb-3">
            Failed to load profiles: {error}
          </Card>
        )}
        {profiles.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Loading profiles…
          </p>
        ) : (
          <Tabs defaultValue="view" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mb-3 shrink-0">
              <TabsTrigger value="view">View Profile</TabsTrigger>
              <TabsTrigger value="compare">Compare Profiles</TabsTrigger>
            </TabsList>
            <TabsContent value="view" className="flex-1 overflow-hidden mt-0">
              <ProfileView profiles={profiles} />
            </TabsContent>
            <TabsContent value="compare" className="flex-1 overflow-hidden mt-0">
              <ProfileCompare profiles={profiles} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

export default App;

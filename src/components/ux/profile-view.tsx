import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { ModCard } from "./mod-card";
import type { ModEntry } from "./types";
import { compareVersionStrings, parseDependencyRef, versionStr } from "./types";

function makeSearchBlob(mod: ModEntry): string {
    return [
        mod.name,
        mod.authorName,
        mod.displayName,
        mod.description,
        mod.websiteUrl,
        mod.networkMode,
        mod.packageType,
        mod.enabled ? "enabled true on" : "disabled false off",
        versionStr(mod.versionNumber),
        ...(mod.dependencies ?? []),
        ...(mod.optionalDependencies ?? []),
        ...(mod.incompatibilities ?? []),
    ]
        .join(" ")
        .toLowerCase();
}

function normalizeName(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenizeDescription(text: string) {
    const stopWords = new Set([
        "the",
        "and",
        "for",
        "with",
        "this",
        "that",
        "from",
        "into",
        "mod",
        "adds",
        "add",
    ]);
    return new Set(
        normalizeName(text)
            .split(" ")
            .filter((t) => t.length > 3 && !stopWords.has(t))
    );
}

function jaccard(a: Set<string>, b: Set<string>) {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const value of a) {
        if (b.has(value)) intersection++;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

export function ProfileView({ profiles, modsPath }: { profiles: string[]; modsPath: string }) {
    const [selectedProfile, setSelectedProfile] = useState<string>(profiles[0] ?? "");
    const [mods, setMods] = useState<ModEntry[]>([]);
    const [selectedMod, setSelectedMod] = useState<ModEntry | null>(null);
    const [expandedModName, setExpandedModName] = useState<string | null>(null);
    const [readmeContent, setReadmeContent] = useState("");
    const [readmeLoading, setReadmeLoading] = useState(false);
    const [readmeError, setReadmeError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!selectedProfile) return;
        setSelectedMod(null);
        setExpandedModName(null);
        setLoading(true);
        setError(null);
        invoke<ModEntry[]>("get_profile_mods", { modsPath, profile: selectedProfile })
            .then(setMods)
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    }, [selectedProfile]);

    const loadAppReadme = () => {
        setReadmeLoading(true);
        setReadmeError(null);
        invoke<string>("get_app_readme")
            .then((content) => setReadmeContent(content))
            .catch((e) => {
                setReadmeError(String(e));
                setReadmeContent("");
            })
            .finally(() => setReadmeLoading(false));
    };

    useEffect(() => {
        loadAppReadme();
    }, [selectedProfile]);

    const loadModReadme = (mod: ModEntry) => {
        setSelectedMod(mod);
        setReadmeLoading(true);
        setReadmeError(null);
        invoke<string>("get_mod_readme", { modsPath, profile: selectedProfile, modName: mod.name })
            .then((content) => setReadmeContent(content))
            .catch((e) => {
                setReadmeError(String(e));
                setReadmeContent("");
            })
            .finally(() => setReadmeLoading(false));
    };

    const handleModOpenChange = (mod: ModEntry, open: boolean) => {
        if (open) {
            setExpandedModName(mod.name);
            loadModReadme(mod);
            return;
        }

        if (expandedModName === mod.name) {
            setExpandedModName(null);
            setSelectedMod(null);
            loadAppReadme();
        }
    };

    const modByName = useMemo(() => new Map(mods.map((m) => [m.name, m])), [mods]);

    const dependencyHealth = useMemo(() => {
        const missing: string[] = [];
        const disabled: string[] = [];
        const versionMismatch: string[] = [];
        const incompatibilities: string[] = [];

        for (const mod of mods) {
            if (!mod.enabled) continue;

            for (const depRaw of mod.dependencies) {
                const dep = parseDependencyRef(depRaw);
                const target = modByName.get(dep.packageName);

                if (!target) {
                    missing.push(`${mod.name} -> ${dep.packageName}`);
                    continue;
                }
                if (!target.enabled) {
                    disabled.push(`${mod.name} -> ${dep.packageName}`);
                    continue;
                }

                if (dep.requiredVersion) {
                    const current = versionStr(target.versionNumber);
                    if (compareVersionStrings(current, dep.requiredVersion) !== 0) {
                        versionMismatch.push(
                            `${mod.name} needs ${dep.packageName}@${dep.requiredVersion} (found ${current})`
                        );
                    }
                }
            }

            for (const incRaw of mod.incompatibilities ?? []) {
                const inc = parseDependencyRef(incRaw);
                const target = modByName.get(inc.packageName);
                if (target?.enabled) {
                    incompatibilities.push(`${mod.name} x ${inc.packageName}`);
                }
            }
        }

        return {
            missing,
            disabled,
            versionMismatch,
            incompatibilities,
            totalIssues:
                missing.length + disabled.length + versionMismatch.length + incompatibilities.length,
        };
    }, [mods, modByName]);

    const optionalDependencyInsight = useMemo(() => {
        const installed = new Set(mods.map((m) => m.name));
        let totalOptionalRefs = 0;
        let installedOptionalRefs = 0;

        for (const mod of mods) {
            for (const depRaw of mod.optionalDependencies ?? []) {
                totalOptionalRefs++;
                const dep = parseDependencyRef(depRaw);
                if (installed.has(dep.packageName)) installedOptionalRefs++;
            }
        }

        return {
            totalOptionalRefs,
            installedOptionalRefs,
            missingOptionalRefs: totalOptionalRefs - installedOptionalRefs,
            installedSet: installed,
        };
    }, [mods]);

    const recentChanges = useMemo(
        () =>
            [...mods]
                .filter((m) => m.installedAtTime)
                .sort((a, b) => (b.installedAtTime ?? 0) - (a.installedAtTime ?? 0))
                .slice(0, 8),
        [mods]
    );

    const authorGroups = useMemo(() => {
        const map = new Map<string, { total: number; enabled: number }>();
        for (const mod of mods) {
            const current = map.get(mod.authorName) ?? { total: 0, enabled: 0 };
            current.total++;
            if (mod.enabled) current.enabled++;
            map.set(mod.authorName, current);
        }
        return [...map.entries()]
            .map(([author, v]) => ({ author, ...v }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8);
    }, [mods]);

    const packageTypeGroups = useMemo(() => {
        const map = new Map<string, number>();
        for (const mod of mods) {
            const key = mod.packageType || "unknown";
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return [...map.entries()]
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);
    }, [mods]);

    const duplicates = useMemo(() => {
        const findings: string[] = [];

        const byDisplay = new Map<string, ModEntry[]>();
        for (const mod of mods) {
            const key = normalizeName(mod.displayName);
            if (!key) continue;
            const list = byDisplay.get(key) ?? [];
            list.push(mod);
            byDisplay.set(key, list);
        }

        for (const [key, group] of byDisplay.entries()) {
            if (group.length > 1) {
                findings.push(`Same display name '${key}': ${group.map((g) => g.name).join(", ")}`);
            }
        }

        const descTokens = mods.map((m) => ({ mod: m, tokens: tokenizeDescription(m.description) }));
        for (let i = 0; i < descTokens.length; i++) {
            for (let j = i + 1; j < descTokens.length; j++) {
                const a = descTokens[i];
                const b = descTokens[j];
                if (a.mod.name === b.mod.name) continue;
                if (a.mod.authorName === b.mod.authorName) continue;
                const sim = jaccard(a.tokens, b.tokens);
                if (sim >= 0.65) {
                    findings.push(
                        `Potential overlap (${Math.round(sim * 100)}%): ${a.mod.name} <-> ${b.mod.name}`
                    );
                }
            }
        }

        return findings.slice(0, 10);
    }, [mods]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [...mods].sort((a, b) => a.displayName.localeCompare(b.displayName));
        return mods
            .filter((m) => makeSearchBlob(m).includes(q))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [mods, search]);

    const enabledCount = mods.filter((m) => m.enabled).length;

    return (
        <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div id="profilefinder" className="flex items-end justify-end align-bottom gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">Profile</span>
                    <Select value={selectedProfile} onValueChange={(v) => v && setSelectedProfile(v)}>
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
                    <div className="flex gap-3 text-sm">
                        <span className="text-foreground">{mods.length} mods</span>
                        <span className="text-green-400">{enabledCount} enabled</span>
                        <span className="text-muted-foreground">{mods.length - enabledCount} disabled</span>
                        <span className={dependencyHealth.totalIssues > 0 ? "text-orange-400" : "text-green-400"}>
                            {dependencyHealth.totalIssues} health issues
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                        <Input
                            className="pl-6"
                            placeholder="Search all mod fields"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div id="profileanalytics">
                <details open className="rounded-md border border-border bg-card/30 px-3 py-2 text-xs">
                    <summary className="cursor-pointer select-none font-medium tracking-wide uppercase text-muted-foreground">Analytics</summary>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                        <div>
                            <p className="font-medium text-foreground mb-1">Dependency health</p>
                            <ul className="space-y-0.5">
                                <li className={dependencyHealth.missing.length > 0 ? "text-red-400" : ""}>
                                    {dependencyHealth.missing.length} missing
                                </li>
                                <li className={dependencyHealth.disabled.length > 0 ? "text-orange-400" : ""}>
                                    {dependencyHealth.disabled.length} disabled
                                </li>
                                <li className={dependencyHealth.versionMismatch.length > 0 ? "text-yellow-400" : ""}>
                                    {dependencyHealth.versionMismatch.length} outdated
                                </li>
                                <li className={dependencyHealth.incompatibilities.length > 0 ? "text-red-400" : ""}>
                                    {dependencyHealth.incompatibilities.length} incompatibilities
                                </li>
                            </ul>
                        </div>

                        {authorGroups.length > 0 && (
                            <div>
                                <p className="font-medium text-foreground mb-1">Top authors</p>
                                <ul className="space-y-0.5">
                                    {authorGroups.slice(0, 5).map((a) => (
                                        <li key={a.author}>{a.author}: {a.total}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {recentChanges.length > 0 && (
                            <div className="col-span-2">
                                <p className="font-medium text-foreground mb-1">Recent installs</p>
                                <ul className="space-y-0.5">
                                    {recentChanges.slice(0, 4).map((m) => (
                                        <li key={m.name}>
                                            {m.displayName}
                                            <span className="ml-1 text-muted-foreground/60">
                                                {new Date(m.installedAtTime ?? 0).toLocaleDateString()}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </details>
            </div>

            <div id="moddetails">

                {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>}
                {error && (
                    <Card className="ring-0 border border-destructive text-destructive px-3 py-2 text-sm">{error}</Card>
                )}
                {!loading && !error && (
                    <ScrollArea className="flex-1 min-h-0">
                        <div className="flex flex-col gap-1 pb-4">
                            {filtered.map((mod) => (
                                <ModCard
                                    key={mod.name}
                                    mod={mod}
                                    selected={selectedMod?.name === mod.name}
                                    open={expandedModName === mod.name}
                                    installedPackageNames={optionalDependencyInsight.installedSet}
                                    onOpenChange={handleModOpenChange}
                                />
                            ))}
                            {filtered.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-8">No mods match your filters.</p>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>

            <div id="readthis">
                <Card className="ring-0 border border-border rounded-md py-0 gap-0 min-h-0 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border">
                        <p className="text-2xl font-semibold">Read This</p>
                        <p className="text-[13px] text-muted-foreground">
                            {selectedMod ? `Source: ${selectedProfile}` : "Default app documentation"} {"->"}{" "}
                            {selectedMod ? selectedMod.displayName : ""}
                        </p>
                    </div>
                    <ScrollArea className="flex-1 min-h-0">
                        <div className="px-3 py-2.5">
                            {readmeLoading && <p className="text-xs text-muted-foreground">Loading README...</p>}
                            {!readmeLoading && readmeError && <p className="text-xs text-destructive">{readmeError}</p>}
                            {!readmeLoading && !readmeError && (
                                <div className="text-xs text-foreground leading-relaxed">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h1: ({ children }) => (
                                                <h1 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h1>
                                            ),
                                            h2: ({ children }) => <h2 className="text-sm font-semibold mt-4 mb-2">{children}</h2>,
                                            h3: ({ children }) => (
                                                <h3 className="text-xs font-semibold mt-3 mb-1.5">{children}</h3>
                                            ),
                                            p: ({ children }) => <p className="mb-2">{children}</p>,
                                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                                            li: ({ children }) => <li className="mb-1">{children}</li>,
                                            code: ({ children }) => (
                                                <code className="font-mono bg-muted/60 px-1 py-0.5 rounded">{children}</code>
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
                                                    <table className="w-full border-collapse">{children}</table>
                                                </div>
                                            ),
                                            th: ({ children }) => (
                                                <th className="border border-border px-2 py-1 text-left bg-muted/50">{children}</th>
                                            ),
                                            td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
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

        </div>
    );
}

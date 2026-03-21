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
import type { FilterMode, ModEntry, SortMode } from "./types";
import { versionStr } from "./types";

export function ProfileView({ profiles }: { profiles: string[] }) {
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
    const [filter, setFilter] = useState<FilterMode>("all");
    const [sort, setSort] = useState<SortMode>("name");

    useEffect(() => {
        if (!selectedProfile) return;
        setSelectedMod(null);
        setExpandedModName(null);
        setLoading(true);
        setError(null);
        invoke<ModEntry[]>("get_profile_mods", { profile: selectedProfile })
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
        invoke<string>("get_mod_readme", { profile: selectedProfile, modName: mod.name })
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
            if (sort === "version") {
                return versionStr(b.versionNumber).localeCompare(versionStr(a.versionNumber));
            }
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
                        <span className="font-semibold text-muted-foreground uppercase tracking-wide">
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
                        <div className="flex gap-3 text-sm">
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
                            placeholder="Search mods..."
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
                        <span className="text-muted-foreground">
                            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                {loading && (
                    <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
                )}
                {error && (
                    <Card className="ring-0 border border-destructive text-destructive px-3 py-2 text-sm">
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
                                    open={expandedModName === mod.name}
                                    onOpenChange={handleModOpenChange}
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
                    <p className="text-[13px] text-muted-foreground">
                        {selectedMod ? `Source: ${selectedProfile}` : "Default app documentation"}
                    </p>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-3 py-2.5">
                        {readmeLoading && (
                            <p className="text-xs text-muted-foreground">Loading README...</p>
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
                                            <code className="font-mono  bg-muted/60 px-1 py-0.5 rounded">
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
                                                <table className="w-full border-collapse ">{children}</table>
                                            </div>
                                        ),
                                        th: ({ children }) => (
                                            <th className="border border-border px-2 py-1 text-left bg-muted/50">
                                                {children}
                                            </th>
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

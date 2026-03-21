import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { CompareSection } from "./compare-section";
import type { ModEntry } from "./types";
import { versionStr } from "./types";

export function ProfileCompare({ profiles }: { profiles: string[] }) {
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
            (m) => versionStr(m.versionNumber) === versionStr(mapB.get(m.name)!.versionNumber)
        );
        const enabledStateDiffs = inBoth.filter(
            (m) => m.enabled !== (mapB.get(m.name)?.enabled ?? m.enabled)
        );
        const enabledStateLabels = new Map(
            enabledStateDiffs.map((m) => {
                const bEnabled = mapB.get(m.name)?.enabled ?? false;
                return [m.name, `A:${m.enabled ? "on" : "off"} -> B:${bEnabled ? "on" : "off"}`];
            })
        );
        return {
            onlyInA,
            onlyInB,
            diffs,
            bVersionsForDiffs,
            same,
            enabledStateDiffs,
            enabledStateLabels,
        };
    }, [modsA, modsB]);

    const loading = loadingA || loadingB;
    const ready = modsA.length > 0 || modsB.length > 0;

    const statItems = [
        { label: "mods in A", value: modsA.length, color: "" },
        { label: "mods in B", value: modsB.length, color: "" },
        { label: "only in A", value: cmp.onlyInA.length, color: "text-blue-400" },
        { label: "only in B", value: cmp.onlyInB.length, color: "text-orange-400" },
        { label: "ver. diffs", value: cmp.diffs.length, color: "text-primary" },
        { label: "enabled diffs", value: cmp.enabledStateDiffs.length, color: "text-amber-400" },
        { label: "identical", value: cmp.same.length, color: "text-green-400" },
    ];

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-400 uppercase tracking-wide">
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
                    <span className="font-semibold text-orange-400 uppercase tracking-wide">
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
                <p className="text-xl text-muted-foreground text-center py-8">Loading...</p>
            )}

            {!loading && ready && (
                <ScrollArea className="flex-1">
                    <div className="space-y-3 pb-4">
                        <div className="flex gap-2 flex-wrap">
                            {statItems.map(({ label, value, color }) => (
                                <Card
                                    key={label}
                                    className="ring-0 border border-border py-2 gap-0.5 px-4 min-w-[72px] items-center rounded-md"
                                >
                                    <span
                                        className={cn("text-xl font-bold leading-none", color || "text-foreground")}
                                    >
                                        {value}
                                    </span>
                                    <span className="text-[13px] text-muted-foreground uppercase tracking-wide">
                                        {label}
                                    </span>
                                </Card>
                            ))}
                        </div>

                        <Separator />

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

                        {cmp.enabledStateDiffs.length > 0 && (
                            <CompareSection
                                title="Enabled-state differences"
                                mods={cmp.enabledStateDiffs}
                                accentClass="border-t-amber-500"
                                rightLabelByName={cmp.enabledStateLabels}
                            />
                        )}

                        {cmp.same.length > 0 && (
                            <details className="group">
                                <summary className="text-lg text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1 select-none">
                                    Common mods ({cmp.same.length})
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

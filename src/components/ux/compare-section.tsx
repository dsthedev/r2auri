import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { ModEntry } from "./types";
import { versionStr } from "./types";

interface CompareSectionProps {
    title: string;
    mods: ModEntry[];
    accentClass: string;
    bVersions?: Map<string, string>;
}

export function CompareSection({
    title,
    mods,
    accentClass,
    bVersions,
}: CompareSectionProps) {
    if (mods.length === 0) return null;

    return (
        <Card
            className={cn(
                "ring-0 border border-border border-t-2 overflow-hidden py-0 gap-0 rounded-md",
                accentClass
            )}
        >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold">{title}</span>
                <Badge variant="secondary" className="text-[13px] h-4 px-1.5 leading-none">
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
                                <span className="text-lg font-medium truncate block">{mod.displayName}</span>
                                <span className="text-sm text-muted-foreground">{mod.authorName}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 font-mono text-muted-foreground">
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

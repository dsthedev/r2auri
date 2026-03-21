import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowSquareOutIcon, CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { ModEntry } from "./types";
import { parseDependencyRef, versionStr } from "./types";

interface ModCardProps {
    mod: ModEntry;
    selected?: boolean;
    open: boolean;
    installedPackageNames?: Set<string>;
    onOpenChange: (mod: ModEntry, open: boolean) => void;
}

export function ModCard({
    mod,
    selected,
    open,
    installedPackageNames,
    onOpenChange,
}: ModCardProps) {
    const optionalDeps = mod.optionalDependencies ?? [];

    return (
        <Collapsible open={open} onOpenChange={(nextOpen) => onOpenChange(mod, nextOpen)}>
            <Card
                className={cn(
                    "ring-0 border border-border py-0 gap-0 rounded-md",
                    selected && "border-primary/70 bg-muted/20",
                    !mod.enabled && "opacity-50"
                )}
            >
                <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/30 transition-colors cursor-pointer rounded-none">
                    <div className="size-8 shrink-0 overflow-hidden rounded">
                        {mod.icon ? (
                            <img src={mod.icon} alt="" className="size-8 object-cover" />
                        ) : (
                            <div className="size-8 bg-muted flex items-center justify-center text-muted-foreground text-sm rounded">
                                ?
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-lg font-semibold truncate">{mod.displayName}</div>
                        <div className="text-sm text-muted-foreground">{mod.authorName}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xl text-muted-foreground font-mono">
                            v{versionStr(mod.versionNumber)}
                        </span>
                        <Badge
                            variant={mod.enabled ? "default" : "secondary"}
                            className="text-[13px] px-1.5 h-4 leading-none"
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
                            <p className="text-muted-foreground leading-relaxed">
                                {mod.description}
                            </p>
                        )}
                        {mod.dependencies.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[13px] font-medium text-foreground/80">
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
                        {optionalDeps.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[13px] font-medium text-foreground/80">Optional add-ons</p>
                                <div className="flex flex-wrap gap-1">
                                    {optionalDeps.map((dep) => {
                                        const ref = parseDependencyRef(dep);
                                        const installed = installedPackageNames?.has(ref.packageName) ?? false;
                                        return (
                                            <Badge
                                                key={dep}
                                                variant={installed ? "default" : "secondary"}
                                                className="text-[9px] font-mono px-1.5 h-4 leading-none"
                                            >
                                                {installed ? "+" : "-"} {ref.packageName}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <button
                            className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline cursor-pointer"
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

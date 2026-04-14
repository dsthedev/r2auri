import { useMemo, useState } from "react";
import { CaretDownIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import type { SpawnerObject } from "@/features/spawner-manager/types";

export function SpawnerList({
  imageMap,
  onAdd,
  onDelete,
  onEdit,
  spawners,
}: {
  imageMap?: Map<string, string>;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onEdit: (spawner: SpawnerObject, index: number) => void;
  spawners: SpawnerObject[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  const filteredSpawners = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return spawners.map((spawner, index) => ({ spawner, index }));
    }

    return spawners
      .map((spawner, index) => ({ spawner, index }))
      .filter(({ spawner }) => {
        return (
          String(spawner.name ?? "").toLowerCase().includes(normalized) ||
          String(spawner.m_prefabName ?? "").toLowerCase().includes(normalized) ||
          String(spawner.prefabToCopy ?? "").toLowerCase().includes(normalized)
        );
      });
  }, [searchTerm, spawners]);

  return (
    <Card className="border border-border/80 bg-card/80">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Spawners ({filteredSpawners.length})</CardTitle>
            <CardDescription>Browse, inspect, edit, and delete YAML spawner entries.</CardDescription>
          </div>
          <Button size="sm" onClick={onAdd}>
            <PlusIcon size={14} />
            Add Spawner
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input placeholder="Search spawners..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        <div className="space-y-2">
          {filteredSpawners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spawners found.</p>
          ) : (
            filteredSpawners.map(({ index, spawner }) => {
              const key = `${index}-${String(spawner.name ?? "spawner")}`;
              const prefabNames = String(spawner.m_prefabName ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              return (
                <Collapsible key={key} open={Boolean(openKeys[key])} onOpenChange={(next) => setOpenKeys((current) => ({ ...current, [key]: next }))}>
                  <div className="border border-border/80 bg-background/40">
                    <div className="flex items-center gap-2 px-4 py-3">
                      <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <CaretDownIcon size={14} className={`shrink-0 transition-transform ${openKeys[key] ? "rotate-180" : ""}`} />
                        {prefabNames.length > 0 && imageMap && imageMap.get(prefabNames[0]) && (
                          <img src={imageMap.get(prefabNames[0])} alt="" className="h-12 w-12 shrink-0 object-contain" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{String(spawner.name ?? `Spawner ${index + 1}`)}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {spawner.m_prefabName && <Badge variant="outline">{String(spawner.m_prefabName)}</Badge>}
                            {spawner.m_maxTotal !== undefined && <Badge variant="outline">Max: {String(spawner.m_maxTotal)}</Badge>}
                            {spawner.minLevel !== undefined && spawner.maxLevel !== undefined && (
                              <Badge variant="outline">Lvl {String(spawner.minLevel)}-{String(spawner.maxLevel)}</Badge>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <Button variant="outline" size="sm" onClick={() => onEdit(spawner, index)}>
                        <PencilSimpleIcon size={14} />
                        Edit
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => onDelete(index)}>
                        <TrashIcon size={14} className="text-red-500" />
                      </Button>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t border-border/70 px-4 py-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {Object.entries(spawner).map(([keyName, value]) => (
                            <div key={keyName} className="border border-border/60 bg-background/50 px-3 py-2 text-sm">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{keyName}</p>
                              <p className="mt-1 break-all font-mono text-xs text-foreground/90">{typeof value === "boolean" ? (value ? "true" : "false") : String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
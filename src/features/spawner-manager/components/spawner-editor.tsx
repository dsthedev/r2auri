import { useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PrefabCombobox } from "@/features/spawner-manager/components/prefab-combobox";
import type { SpawnerObject } from "@/features/spawner-manager/types";

const NUMBER_FIELDS: Array<{ key: keyof SpawnerObject; label: string }> = [
  { key: "m_spawnTimer", label: "Spawn Timer" },
  { key: "m_maxTotal", label: "Max Total" },
  { key: "m_maxNear", label: "Max Near" },
  { key: "m_farRadius", label: "Far Radius" },
  { key: "m_spawnRadius", label: "Spawn Radius" },
  { key: "m_triggerDistance", label: "Trigger Distance" },
  { key: "m_spawnIntervalSec", label: "Spawn Interval (sec)" },
  { key: "m_levelupChance", label: "Levelup Chance" },
  { key: "m_nearRadius", label: "Near Radius" },
  { key: "minLevel", label: "Min Level" },
  { key: "maxLevel", label: "Max Level" },
  { key: "HitPoints", label: "Hit Points" },
  { key: "multiSpawn", label: "Multi Spawn" },
];

const BOOLEAN_FIELDS: Array<{ key: keyof SpawnerObject; label: string }> = [
  { key: "m_onGroundOnly", label: "On Ground Only" },
  { key: "m_setPatrolSpawnPoint", label: "Set Patrol Spawn Point" },
  { key: "mobTarget", label: "Mob Target" },
];

export function SpawnerEditor({
  creatures,
  imageMap,
  onCancel,
  onSave,
  pieces,
  spawner,
}: {
  creatures: string[];
  imageMap: Map<string, string>;
  onCancel: () => void;
  onSave: (spawner: SpawnerObject) => void;
  pieces: string[];
  spawner?: SpawnerObject;
}) {
  const [formData, setFormData] = useState<SpawnerObject>(
    spawner ?? {
      name: "",
      prefabToCopy: "",
      m_prefabName: "",
      minLevel: 1,
      maxLevel: 1,
      m_spawnTimer: 2,
      m_spawnIntervalSec: 2,
      m_levelupChance: 100,
      m_maxTotal: 10,
      m_maxNear: 10,
      m_farRadius: 20,
      m_spawnRadius: 6,
      m_nearRadius: 1,
      m_triggerDistance: 10,
      m_onGroundOnly: false,
      m_setPatrolSpawnPoint: true,
      HitPoints: 100,
      mobTarget: false,
      multiSpawn: 0,
    }
  );

  const handleNumberChange = (key: keyof SpawnerObject, rawValue: string) => {
    setFormData((current) => ({
      ...current,
      [key]: Number.isFinite(Number.parseFloat(rawValue)) ? Number.parseFloat(rawValue) : 0,
    }));
  };

  const handleBooleanChange = (key: keyof SpawnerObject, checked: boolean) => {
    setFormData((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const handleStringChange = (key: keyof SpawnerObject, value: string) => {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/70 px-5 py-5 backdrop-blur-[1px]">
      <Card className="mx-auto flex h-full max-w-4xl flex-col border border-border/80 bg-card/95">
        <CardHeader className="border-b border-border/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{spawner ? `Edit ${spawner.name}` : "New Spawner"}</CardTitle>
              <CardDescription>
                Direct editor for one WackyMole custom spawner entry.
              </CardDescription>
            </div>
            <Button variant="outline" size="icon-sm" onClick={onCancel}>
              <XIcon size={14} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-auto py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input value={String(formData.name ?? "")} onChange={(event) => handleStringChange("name", event.target.value)} />
            </Field>
            <Field label="Prefab To Copy">
              <PrefabCombobox options={pieces} value={String(formData.prefabToCopy ?? "")} onChange={(value) => handleStringChange("prefabToCopy", value)} imageMap={imageMap} placeholder="Select or search piece..." />
            </Field>
            <Field label="Prefab Name" className="md:col-span-2">
              <PrefabCombobox options={creatures} value={String(formData.m_prefabName ?? "")} onChange={(value) => handleStringChange("m_prefabName", value)} imageMap={imageMap} placeholder="Select or search creature..." />
            </Field>
            {NUMBER_FIELDS.map((field) => (
              <Field key={String(field.key)} label={field.label}>
                <Input
                  type="number"
                  value={Number(formData[field.key] ?? 0)}
                  onChange={(event) => handleNumberChange(field.key, event.target.value)}
                />
              </Field>
            ))}
            {BOOLEAN_FIELDS.map((field) => (
              <Field key={String(field.key)} label={field.label}>
                <label className="flex h-8 items-center gap-2 border border-input px-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(formData[field.key])}
                    onChange={(event) => handleBooleanChange(field.key, event.target.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              </Field>
            ))}
          </div>
        </CardContent>
        <div className="border-t border-border/70 px-5 py-4">
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onSave(formData)} disabled={!String(formData.name ?? "").trim()}>
              Save Spawner
            </Button>
            <Button className="flex-1" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
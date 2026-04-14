import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SpawnerEditor } from "@/features/spawner-manager/components/spawner-editor";
import { SpawnerList } from "@/features/spawner-manager/components/spawner-list";
import { usePrefabData } from "@/features/spawner-manager/hooks/use-prefab-data";
import type { SpawnerObject } from "@/features/spawner-manager/types";

type SpawnerConfigDocument = {
  filePath: string;
  spawners: SpawnerObject[];
};

export function SpawnerManagerPage({ configPath }: { configPath: string | null }) {
  const { creatures, pieces, imageMap, loading: prefabLoading } = usePrefabData();
  const [spawners, setSpawners] = useState<SpawnerObject[]>([]);
  const [loadedSpawners, setLoadedSpawners] = useState<SpawnerObject[]>([]);
  const [editingSpawner, setEditingSpawner] = useState<{ index: number; spawner?: SpawnerObject } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [yamlPreview, setYamlPreview] = useState("");

  const isDirty = useMemo(() => JSON.stringify(spawners) !== JSON.stringify(loadedSpawners), [loadedSpawners, spawners]);

  useEffect(() => {
    const renderPreview = async () => {
      try {
        const yaml = await invoke<string>("render_spawner_config_yaml", { spawners });
        setYamlPreview(yaml);
      } catch {
        setYamlPreview("");
      }
    };

    void renderPreview();
    setCopied(false);
  }, [spawners]);

  useEffect(() => {
    if (!configPath) {
      return;
    }

    void loadConfig(configPath);
  }, [configPath]);

  const loadConfig = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      setSaveMessage(null);
      const document = await invoke<SpawnerConfigDocument>("read_spawner_config", { configPath: path });
      setSpawners(document.spawners);
      setLoadedSpawners(document.spawners);
      setCopied(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSpawners([]);
      setLoadedSpawners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!configPath) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await invoke("save_spawner_config", { configPath, spawners });
      setLoadedSpawners(spawners);
      setSaveMessage("Spawner config saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSaveMessage(null);
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    if (!configPath) {
      return;
    }

    await loadConfig(configPath);
  };

  const handleCopy = async () => {
    const yaml = await invoke<string>("render_spawner_config_yaml", { spawners });
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
  };

  const handleSaveSpawner = (nextSpawner: SpawnerObject) => {
    setSpawners((current) => {
      if (editingSpawner?.spawner && editingSpawner.index >= 0) {
        return current.map((spawner, index) => (index === editingSpawner.index ? nextSpawner : spawner));
      }
      return [...current, nextSpawner];
    });
    setEditingSpawner(null);
    setSaveMessage(null);
  };

  return (
    <div className="flex-1 overflow-auto px-5 py-3">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Spawner Manager</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Edit WackyMole custom spawner entries directly from the active profile config.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleReload} disabled={!configPath || loading || saving}>Reload File</Button>
            <Button variant="outline" onClick={handleCopy} disabled={spawners.length === 0}>Copy YAML</Button>
            <Button onClick={handleSave} disabled={!configPath || loading || saving || !isDirty}>Save To File</Button>
          </div>
        </div>

        <Card className="border border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle>Source File</CardTitle>
            <CardDescription>
              Reads and writes the active WackyMole.CustomSpawners.yml file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="font-mono text-xs break-all text-foreground/90">{configPath ?? "No config detected."}</p>
            <div className="flex flex-wrap gap-2">
              {loading && <span>Loading current file...</span>}
              {saving && <span>Saving spawners...</span>}
              {prefabLoading && <span>Loading prefab catalog...</span>}
              {copied && <span>Copied YAML output.</span>}
              {saveMessage && <span className="text-roygbiv-green">{saveMessage}</span>}
              {isDirty && !saving && <span className="text-roygbiv-orange">Unsaved changes</span>}
            </div>
            {error && <p className="text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <SpawnerList
            spawners={spawners}
            onAdd={() => setEditingSpawner({ index: -1 })}
            onDelete={(index) => {
              setSpawners((current) => current.filter((_, currentIndex) => currentIndex !== index));
              setSaveMessage(null);
            }}
            onEdit={(spawner, index) => setEditingSpawner({ spawner, index })}
            imageMap={imageMap}
          />

          <Card className="border border-border/80 bg-card/80">
            <CardHeader>
              <CardTitle>YAML Preview</CardTitle>
              <CardDescription>
                Current YAML generated from the in-memory spawner list. Save writes this structure to disk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={yamlPreview}
                readOnly
                className="min-h-128 w-full rounded-none border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none"
              />
            </CardContent>
          </Card>
        </div>

        {editingSpawner && (
          <SpawnerEditor
            creatures={creatures}
            pieces={pieces}
            imageMap={imageMap}
            spawner={editingSpawner.spawner}
            onSave={handleSaveSpawner}
            onCancel={() => setEditingSpawner(null)}
          />
        )}
      </div>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Scroll, Stack } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/hooks/use-settings";
import type { ModEntry } from "@/components/ux/types";

export function ModsPage() {
  const { settings, loading: settingsLoading } = useSettings();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingMods, setLoadingMods] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settingsLoading || !settings?.valheim_mods_path) {
      return;
    }

    const loadProfiles = async () => {
      try {
        setLoadingProfiles(true);
        setError(null);
        const result = await invoke<string[]>("list_profiles", {
          modsPath: settings.valheim_mods_path,
        });
        setProfiles(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setProfiles([]);
      } finally {
        setLoadingProfiles(false);
      }
    };

    loadProfiles();
  }, [settings?.valheim_mods_path, settingsLoading]);

  useEffect(() => {
    if (profiles.length === 0) {
      setSelectedProfile("");
      return;
    }

    const preferred = settings?.default_profile;
    if (preferred && profiles.includes(preferred)) {
      setSelectedProfile((current) => (current && profiles.includes(current) ? current : preferred));
      return;
    }

    setSelectedProfile((current) => (current && profiles.includes(current) ? current : profiles[0]));
  }, [profiles, settings?.default_profile]);

  useEffect(() => {
    if (!settings?.valheim_mods_path || !selectedProfile) {
      setMods([]);
      return;
    }

    const loadMods = async () => {
      try {
        setLoadingMods(true);
        setError(null);

        const allMods = await invoke<ModEntry[]>("get_profile_mods", {
          modsPath: settings.valheim_mods_path,
          profile: selectedProfile,
        });

        const activeMods = allMods
          .filter((mod) => mod.enabled)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        setMods(activeMods);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setMods([]);
      } finally {
        setLoadingMods(false);
      }
    };

    loadMods();
  }, [selectedProfile, settings?.valheim_mods_path]);

  const hasPath = Boolean(settings?.valheim_mods_path);
  const profileCount = useMemo(() => Math.max(profiles.length, 0), [profiles.length]);

  if (settingsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center px-5 py-3">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!hasPath) {
    return (
      <div className="flex-1 overflow-auto px-5 py-3">
        <Card className="p-6 border-yellow-600 bg-yellow-950/20">
          <p className="text-sm text-muted-foreground">
            Configure a Valheim mods path in Settings to browse profile mods.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-5 py-3 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Mods</h1>
        <p className="text-sm text-muted-foreground">Enabled mods from mods.yml for the selected profile.</p>
      </div>

      <Card className="border border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Source</CardTitle>
          <CardDescription>{settings?.valheim_mods_path}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="min-w-56">
            <Select
              value={selectedProfile}
              onValueChange={(value) => setSelectedProfile(value ?? "")}
              disabled={loadingProfiles || profiles.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile} value={profile}>
                    {profile}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProfile && <Badge variant="outline">Profile: {selectedProfile}</Badge>}
          <Badge variant="outline">Profiles found: {profileCount}</Badge>
          <Badge>Active mods: {mods.length}</Badge>
        </CardContent>
      </Card>

      {error && (
        <Card className="ring-0 border border-destructive text-destructive text-sm px-3 py-2">
          Failed to load mods: {error}
        </Card>
      )}

      {loadingMods ? (
        <Card className="p-6 border border-border/80 bg-card/80">
          <p className="text-sm text-muted-foreground">Loading active mods...</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mods.map((mod) => (
            <Card key={mod.name} className="border border-border/80 bg-card/80">
              <CardHeader>
                <CardTitle className="text-sm">{mod.displayName}</CardTitle>
                <CardDescription>{mod.authorName}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 pt-0">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {mod.name}
                </Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Stack size={14} />
                  Enabled
                </div>
              </CardContent>
            </Card>
          ))}

          {!loadingMods && mods.length === 0 && (
            <Card className="p-6 border border-dashed border-border/80 bg-background/40 md:col-span-2 xl:col-span-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Scroll size={16} />
                No enabled mods found in this profile.
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

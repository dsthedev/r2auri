import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, GearSix, Scroll, Star, Wrench, X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileLogView } from "@/components/ux/profile-log-view";
import { useSettings } from "@/hooks/use-settings";
import type { ProfileConfigIndex } from "@/types/config-index";

export function ProfilesPage({
  onNavigateToSettings,
  profileSheetRequestKey,
  onSelectedProfileChange,
}: {
  onNavigateToSettings: () => void;
  profileSheetRequestKey: number;
  onSelectedProfileChange?: (profile: string) => void;
}) {
  const { settings, loading: settingsLoading } = useSettings();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settingsLoading) return;
    if (!settings?.valheim_mods_path) return;

    const loadProfiles = async () => {
      try {
        setLoading(true);
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
        setLoading(false);
      }
    };

    loadProfiles();
  }, [settings?.valheim_mods_path, settingsLoading]);

  useEffect(() => {
    if (profiles.length === 0) {
      setSelectedProfile("");
      return;
    }

    const preferredProfile = settings?.default_profile;
    if (preferredProfile && profiles.includes(preferredProfile)) {
      setSelectedProfile((current) => (current && profiles.includes(current) ? current : preferredProfile));
      return;
    }

    setSelectedProfile((current) => (current && profiles.includes(current) ? current : profiles[0]));
  }, [profiles, settings?.default_profile]);

  useEffect(() => {
    setProfileSheetOpen(true);
  }, [profileSheetRequestKey]);

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }

    onSelectedProfileChange?.(selectedProfile);
  }, [onSelectedProfileChange, selectedProfile]);

  // Sort profiles with default at the top
  const sortedProfiles = [
    ...(profiles.filter((p) => p === settings?.default_profile) || []),
    ...profiles.filter((p) => p !== settings?.default_profile),
  ];

  if (settingsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center px-5 py-3">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!settings?.valheim_mods_path) {
    return (
      <div className="flex-1 overflow-auto px-5 py-3 flex flex-col max-w-2xl w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Profiles</h1>
        </div>

        <Card className="p-6 border-yellow-600 bg-yellow-950/20 space-y-4">
          <div>
            <h3 className="font-semibold text-yellow-600 mb-2">
              ⚠️ Configuration Required
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please configure the Valheim mods path in settings before viewing
              profiles.
            </p>
            <Button onClick={onNavigateToSettings}>Go to Settings</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-5 py-3">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Found in: {settings.valheim_mods_path}
          </p>
        </div>

        {selectedProfile && (
          <div className="border border-border/70 bg-card/80 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Active Mod Profile
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">{selectedProfile}</p>
          </div>
        )}
      </div>

      {error && (
        <Card className="ring-0 border border-destructive text-destructive text-sm px-3 py-2 mb-4">
          Failed to load profiles: {error}
        </Card>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Loading profiles...
        </p>
      )}

      {!loading && profiles.length === 0 && (
        <Card className="p-6 border-yellow-600 bg-yellow-950/20">
          <p className="text-sm text-muted-foreground">
            No profiles found in the configured directory. Make sure you have at
            least one Valheim mod profile configured in r2modman.
          </p>
        </Card>
      )}

      {!loading && profiles.length > 0 && (
        <>
          {profileSheetOpen && (
            <button
              type="button"
              aria-label="Close profile sheet"
              className="absolute inset-0 z-20 bg-background/60 backdrop-blur-[1px]"
              onClick={() => setProfileSheetOpen(false)}
            />
          )}

          <div className={`absolute inset-y-3 left-5 z-30 w-[22rem] max-w-[calc(100vw-2.5rem)] transition-transform duration-200 ${
            profileSheetOpen ? "translate-x-0" : "-translate-x-[110%]"
          }`}>
            <Card className="flex h-full flex-col border border-border/80 bg-card/95 shadow-2xl">
              <CardHeader className="border-b border-border/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Available Profiles</CardTitle>
                    <CardDescription>
                      Choose a mod profile to inspect. The configured default is pinned to the top.
                    </CardDescription>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setProfileSheetOpen(false)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto space-y-2 pt-4">
                {sortedProfiles.map((profile, idx) => {
                  const isDefault = profile === settings?.default_profile;
                  const isSelected = profile === selectedProfile;
                  const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'] as const;
                  const colorIdx = idx % colors.length;
                  const color = colors[colorIdx];
                  const colorVars = {
                    red: 'border-roygbiv-red/40 bg-roygbiv-red-muted',
                    orange: 'border-roygbiv-orange/40 bg-roygbiv-orange-muted',
                    yellow: 'border-roygbiv-yellow/40 bg-roygbiv-yellow-muted',
                    green: 'border-roygbiv-green/40 bg-roygbiv-green-muted',
                    blue: 'border-roygbiv-blue/40 bg-roygbiv-blue-muted',
                    indigo: 'border-roygbiv-indigo/40 bg-roygbiv-indigo-muted',
                    violet: 'border-roygbiv-violet/40 bg-roygbiv-violet-muted',
                  };

                  return (
                    <button
                      key={profile}
                      type="button"
                      className={`w-full border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : colorVars[color]
                      }`}
                      onClick={() => {
                        setSelectedProfile(profile);
                        setProfileSheetOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {isDefault ? (
                          <Star size={18} weight="fill" className="mt-0.5 shrink-0 text-yellow-500" />
                        ) : (
                          <Scroll size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{profile}</span>
                            {isDefault && <Badge variant="outline">default</Badge>}
                            {isSelected && <Badge>open</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Profile page with log output tools and future config editing.
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {selectedProfile ? (
              (() => {
                const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'] as const;
                const profileIdx = sortedProfiles.indexOf(selectedProfile);
                const colorIdx = profileIdx >= 0 ? profileIdx % colors.length : 0;
                const color = colors[colorIdx];
                const colorBorders = {
                  red: 'border-l-roygbiv-red',
                  orange: 'border-l-roygbiv-orange',
                  yellow: 'border-l-roygbiv-yellow',
                  green: 'border-l-roygbiv-green',
                  blue: 'border-l-roygbiv-blue',
                  indigo: 'border-l-roygbiv-indigo',
                  violet: 'border-l-roygbiv-violet',
                };

                return (
                  <Card className={`flex h-full min-h-0 flex-col border border-border/80 bg-card/80 border-l-4 ${colorBorders[color]}`}>
                    <CardHeader className="gap-2 border-b border-border/70">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{selectedProfile}</CardTitle>
                          <CardDescription>
                            Profile workspace for logs first, advanced config editing next.
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <GearSix size={16} />
                          Managing profile content inside this workspace
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="flex min-h-0 flex-1 flex-col pt-4">
                      <Tabs defaultValue="log-output" className="flex min-h-0 flex-1 flex-col gap-4">
                        <TabsList variant="line" color={color} className="w-full justify-start border-b border-border/70 pb-1">
                          <TabsTrigger value="log-output" className="flex-none gap-2 px-2.5">
                            <Scroll size={15} />
                            Log Output
                          </TabsTrigger>
                          <TabsTrigger value="config-editor" className="flex-none gap-2 px-2.5">
                            <Wrench size={15} />
                            Config Editor
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="log-output" className="min-h-0 flex-1">
                          <ProfileLogView
                            modsPath={settings.valheim_mods_path}
                            profile={selectedProfile}
                          />
                        </TabsContent>

                        <TabsContent value="config-editor" className="min-h-0 flex-1">
                          <ConfigEditorTab
                            modsPath={settings.valheim_mods_path}
                            profile={selectedProfile}
                          />
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                );
              })()
            ) : (
              <Card className="flex h-full items-center justify-center border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
                Select a profile to begin.
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ConfigEditorTab({ modsPath, profile }: { modsPath: string; profile: string }) {
  const [index, setIndex] = useState<ProfileConfigIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMods, setExpandedMods] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"linked-desc" | "linked-asc" | "name-asc" | "name-desc">("linked-desc");
  const [filterBy, setFilterBy] = useState<"all" | "with-config" | "without-config">("all");

  useEffect(() => {
    const loadConfigIndex = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await invoke<ProfileConfigIndex>("get_profile_config_index", {
          modsPath,
          profile,
        });

        setIndex(result);
        setExpandedMods({});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIndex(null);
      } finally {
        setLoading(false);
      }
    };

    loadConfigIndex();
  }, [modsPath, profile]);

  const handleReveal = async (path: string) => {
    try {
      await invoke("reveal_path_in_file_manager", { path });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const linkedCount =
    index?.mods.reduce((total, group) => total + group.configFiles.length, 0) ?? 0;

  const normalizedQuery = query.trim().toLowerCase();

  const filteredMods = (index?.mods ?? [])
    .filter((group) => {
      if (filterBy === "with-config" && group.configFiles.length === 0) {
        return false;
      }
      if (filterBy === "without-config" && group.configFiles.length > 0) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const modMatch =
        group.displayName.toLowerCase().includes(normalizedQuery) ||
        group.modName.toLowerCase().includes(normalizedQuery) ||
        group.authorName.toLowerCase().includes(normalizedQuery);

      if (modMatch) {
        return true;
      }

      return group.configFiles.some((file) => file.fileName.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => {
      if (sortBy === "linked-desc") {
        return b.configFiles.length - a.configFiles.length || a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === "linked-asc") {
        return a.configFiles.length - b.configFiles.length || a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === "name-desc") {
        return b.displayName.localeCompare(a.displayName);
      }
      return a.displayName.localeCompare(b.displayName);
    });

  const filteredUnlinked = (index?.unlinked ?? []).filter((file) => {
    if (!normalizedQuery) {
      return true;
    }
    return file.fileName.toLowerCase().includes(normalizedQuery);
  });

  return (
    <div className="h-full overflow-auto space-y-3 pr-1">
      <Card className="border border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Config Mapping</CardTitle>
          <CardDescription>
            Active mods are read from mods.yml, then files in BepInEx/config are matched and grouped.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 pt-0">
          <Badge variant="outline">Profile: {profile}</Badge>
          <Badge variant="outline">Linked files: {linkedCount}</Badge>
          <Badge>Unlinked: {index?.unlinked.length ?? 0}</Badge>
          <Badge variant="outline">Visible mods: {filteredMods.length}</Badge>
        </CardContent>
      </Card>

      <Card className="border border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle className="text-sm">Find And Organize</CardTitle>
          <CardDescription>
            Search by mod or config filename, then sort and filter the mod list.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 pt-0">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search mods or files..."
          />

          <Select value={sortBy} onValueChange={(value) => setSortBy((value as typeof sortBy) ?? "linked-desc")}> 
            <SelectTrigger>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linked-desc">Most linked files</SelectItem>
              <SelectItem value="linked-asc">Fewest linked files</SelectItem>
              <SelectItem value="name-asc">Mod name A-Z</SelectItem>
              <SelectItem value="name-desc">Mod name Z-A</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterBy} onValueChange={(value) => setFilterBy((value as typeof filterBy) ?? "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All mods</SelectItem>
              <SelectItem value="with-config">Only mods with configs</SelectItem>
              <SelectItem value="without-config">Only mods without configs</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && (
        <Card className="ring-0 border border-destructive text-destructive text-sm px-3 py-2">
          Failed to load config index: {error}
        </Card>
      )}

      {loading && (
        <Card className="p-6 border border-border/80 bg-card/80">
          <p className="text-sm text-muted-foreground">Scanning active mods and config files...</p>
        </Card>
      )}

      {!loading && index && (
        <div className="space-y-3">
          {filteredMods.map((group) => {
            const open = Boolean(expandedMods[group.modName]);

            return (
              <Collapsible
                key={group.modName}
                open={open}
                onOpenChange={(next) => {
                  setExpandedMods((current) => ({
                    ...current,
                    [group.modName]: next,
                  }));
                }}
              >
                <Card className="border border-border/80 bg-card/70 py-0 gap-0">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{group.displayName}</p>
                        <p className="text-xs text-muted-foreground">{group.authorName}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={group.configFiles.length > 0 ? "default" : "secondary"}>
                          {group.configFiles.length} config
                        </Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {group.modName}
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="border-t border-border/70 space-y-2 py-3">
                      {group.configFiles.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No linked config files found for this mod.</p>
                      ) : (
                        group.configFiles.map((file) => (
                          <div
                            key={file.filePath}
                            className="flex flex-wrap items-center justify-between gap-2 border border-border/70 bg-background/50 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground break-all">{file.fileName}</p>
                              <p className="text-xs text-muted-foreground break-all">{file.filePath}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleReveal(file.filePath)}
                            >
                              <FolderOpen size={14} />
                              Open
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}

          <Card className="border border-dashed border-border/80 bg-background/40">
            <CardHeader>
              <CardTitle className="text-sm">Unlinked Config Files</CardTitle>
              <CardDescription>
                Files that did not confidently map to an enabled mod.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredUnlinked.length === 0 ? (
                <p className="text-xs text-muted-foreground">All scanned files were linked.</p>
              ) : (
                filteredUnlinked.map((file) => (
                  <div
                    key={file.filePath}
                    className="flex flex-wrap items-center justify-between gap-2 border border-border/70 bg-background/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground break-all">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground break-all">{file.filePath}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleReveal(file.filePath)}
                    >
                      <FolderOpen size={14} />
                      Open
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

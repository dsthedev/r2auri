import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GearSix, Scroll, Star, Wrench, X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileLogView } from "@/components/ux/profile-log-view";
import { useSettings } from "@/hooks/use-settings";

export function ProfilesPage({
  onNavigateToSettings,
  profileSheetRequestKey,
}: {
  onNavigateToSettings: () => void;
  profileSheetRequestKey: number;
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
                          <ConfigEditorTab />
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

function ConfigEditorTab() {
  const [roadmapOpen, setRoadmapOpen] = useState(true);

  return (
    <Collapsible open={roadmapOpen} onOpenChange={setRoadmapOpen}>
      <Card className="border border-dashed border-border/80 bg-background/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Advanced Config Editor</CardTitle>
              <CardDescription>
                Coming soon. This will scan BepInEx config files, map them back to mods, group them by category, and expose badges plus richer editing tools.
              </CardDescription>
            </div>

            <CollapsibleTrigger render={<Button type="button" variant="outline" size="sm" />}>
              {roadmapOpen ? "Collapse" : "Expand"}
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The page shell is in place now so the config editor can land without reshaping the rest of the profile workflow.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">config scan</Badge>
              <Badge variant="outline">mod mapping</Badge>
              <Badge variant="outline">category badges</Badge>
              <Badge variant="outline">editor UI</Badge>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Star } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSettings } from "@/hooks/use-settings";

export function ProfilesPage({
  onNavigateToSettings,
}: {
  onNavigateToSettings: () => void;
}) {
  const { settings, loading: settingsLoading } = useSettings();
  const [profiles, setProfiles] = useState<string[]>([]);
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
    <div className="flex-1 overflow-auto px-5 py-3 flex flex-col max-w-2xl w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Profiles</h1>
        <p className="text-sm text-muted-foreground">
          Found in: {settings.valheim_mods_path}
        </p>
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
        <div className="space-y-2">
          {sortedProfiles.map((profile) => {
            const isDefault = profile === settings?.default_profile;
            return (
              <Card
                key={profile}
                className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${
                  isDefault
                    ? "border-2 border-yellow-500 bg-yellow-950/10"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isDefault && (
                    <Star
                      size={18}
                      weight="fill"
                      className="text-yellow-500 shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {profile}
                      {isDefault && (
                        <span className="text-yellow-600 text-xs font-normal ml-2">
                          (default)
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click to manage profile (coming soon)
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

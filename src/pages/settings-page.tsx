import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSettings } from "@/hooks/use-settings";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SettingsPage() {
  const { settings, updateSettings, error: contextError } = useSettings();
  const [modsPath, setModsPath] = useState(settings?.valheim_mods_path || "");
  const [defaultProfile, setDefaultProfile] = useState(
    settings?.default_profile || ""
  );
  const [defaultPath, setDefaultPath] = useState<string>("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch the expanded default path on mount
  useEffect(() => {
    invoke<string>("get_default_mods_path")
      .then(setDefaultPath)
      .catch((err) => console.error("Failed to get default path:", err));
  }, []);

  // Load profiles when modsPath changes
  useEffect(() => {
    if (!modsPath.trim()) {
      setProfiles([]);
      return;
    }

    setLoadingProfiles(true);
    invoke<string[]>("list_profiles", { modsPath })
      .then(setProfiles)
      .catch((err) => {
        console.error("Failed to load profiles:", err);
        setProfiles([]);
      })
      .finally(() => setLoadingProfiles(false));
  }, [modsPath]);

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Valheim Mods Directory",
      });

      if (selected && typeof selected === "string") {
        setModsPath(selected);
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to browse directory: ${message}`);
    }
  };

  const handleReset = () => {
    setModsPath(defaultPath);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      if (!modsPath.trim()) {
        setError("Mods path cannot be empty");
        return;
      }

      await updateSettings({
        valheim_mods_path: modsPath,
        default_profile: defaultProfile,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto px-5 py-3 flex flex-col max-w-2xl w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure the location of your Valheim mod profiles
        </p>
      </div>

      {contextError && (
        <Card className="ring-0 border border-destructive text-destructive text-sm px-3 py-2 mb-4">
          Context Error: {contextError}
        </Card>
      )}

      {error && (
        <Card className="ring-0 border border-destructive text-destructive text-sm px-3 py-2 mb-4">
          {error}
        </Card>
      )}

      {success && (
        <Card className="ring-0 border border-green-600 text-green-600 text-sm px-3 py-2 mb-4">
          Settings saved successfully!
        </Card>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Valheim Mods Path
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={modsPath}
              onChange={(e) => setModsPath(e.target.value)}
              placeholder="/home/username/.config/r2modmanPlus-local/Valheim/profiles"
              className="flex-1"
            />
            <Button variant="outline" onClick={handleBrowse}>
              Browse
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={modsPath === defaultPath || !defaultPath}
            >
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            This should point to your r2modman Valheim profiles directory
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Default Profile
          </label>
          {loadingProfiles ? (
            <p className="text-sm text-muted-foreground">Loading profiles...</p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {modsPath.trim()
                ? "No profiles found at the configured path"
                : "Configure a mods path first to select a profile"}
            </p>
          ) : (
            <Select
              value={defaultProfile}
              onValueChange={(value) => setDefaultProfile(value || "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a default profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile} value={profile}>
                    {profile}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            The default profile will be highlighted on the Profiles page
          </p>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

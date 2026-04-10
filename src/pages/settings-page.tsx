import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/use-settings";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartPatternSettings } from "@/components/ux/smart-pattern-settings";
import { DEFAULT_SMART_PATTERNS, SmartPatternMetadata } from "@/types/smart-patterns";
import { mergePatterns } from "@/lib/pattern-manager";

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
  const [allPatterns, setAllPatterns] = useState<SmartPatternMetadata[]>(
    mergePatterns(settings?.custom_smart_patterns)
  );

  // Update patterns when settings load
  useEffect(() => {
    if (settings) {
      setAllPatterns(mergePatterns(settings.custom_smart_patterns));
    }
  }, [settings?.custom_smart_patterns]);

  // Auto-save custom patterns after user stops editing (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Extract custom patterns (those not in DEFAULT_SMART_PATTERNS)
      const defaultIds = new Set(DEFAULT_SMART_PATTERNS.map(p => p.id));
      const customPatterns = allPatterns.filter(p => !defaultIds.has(p.id));

      // Only save if there are custom patterns or if we previously had some (to clear them)
      if (settings && (customPatterns.length > 0 || settings.custom_smart_patterns?.length)) {
        updateSettings({
          valheim_mods_path: modsPath || settings.valheim_mods_path,
          default_profile: defaultProfile || settings.default_profile,
          custom_smart_patterns: customPatterns.length > 0 ? customPatterns : undefined,
        }).catch(err => console.error("Failed to auto-save patterns:", err));
      }
    }, 2000); // Wait 2 seconds after last pattern change

    return () => clearTimeout(timer);
  }, [allPatterns, modsPath, defaultProfile, settings, updateSettings]);

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

      // Extract only custom patterns (those not in DEFAULT_SMART_PATTERNS)
      const defaultIds = new Set(DEFAULT_SMART_PATTERNS.map(p => p.id));
      const customPatterns = allPatterns.filter(p => !defaultIds.has(p.id));

      await updateSettings({
        valheim_mods_path: modsPath,
        default_profile: defaultProfile,
        custom_smart_patterns: customPatterns.length > 0 ? customPatterns : undefined,
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
    <div className="flex-1 overflow-auto px-5 py-3 flex flex-col w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure r2auri behavior
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
        <Card className="ring-0 border border-roygbiv-green border-l-4 border-l-roygbiv-green text-roygbiv-green text-sm px-3 py-2 mb-4 bg-roygbiv-green-muted">
          Settings saved successfully!
        </Card>
      )}

      <Tabs defaultValue="general" className="flex-1 flex flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="patterns">Smart Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex-1 overflow-auto space-y-4 mt-4">
          <div className="border-l-4 border-l-roygbiv-blue bg-roygbiv-blue-muted p-3 rounded-none">
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

          <div className="border-l-4 border-l-roygbiv-violet bg-roygbiv-violet-muted p-3 rounded-none">
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
        </TabsContent>

        <TabsContent value="patterns" className="flex-1 overflow-auto mt-4">
          <SmartPatternSettings
            patterns={allPatterns}
            onChange={(patterns) => {
              setAllPatterns(patterns);
            }}
          />

          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="w-full mt-4"
          >
            {isSaving ? "Saving..." : "Save Pattern Settings"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

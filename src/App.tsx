import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HeartIcon, PlusIcon, CodeIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SettingsProvider } from "@/contexts/settings-context";
import { SettingsPage } from "@/pages/settings-page";
import { ProfilesPage } from "@/pages/profiles-page";
import { ModsPage } from "@/pages/mods-page";
import { LevelSpreadPage } from "@/pages/level-spread-page";
import { SpawnerManagerPage } from "@/pages/spawner-manager-page";
import { useSettings } from "@/hooks/use-settings";
import type { ProfileFeatureAvailability } from "@/types/feature-detection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setupDarkModeHotkey, toggleDarkMode } from "@/lib/utils";

import "./App.css";

type AppPage = "profiles" | "mods" | "settings" | "level-spread" | "spawner-manager";

function AppContent() {
  const { settings } = useSettings();
  const [currentPage, setCurrentPage] = useState<AppPage>("profiles");
  const [activeProfile, setActiveProfile] = useState<string>("");
  const [profileSheetRequestKey, setProfileSheetRequestKey] = useState(0);
  const [featureAvailability, setFeatureAvailability] =
    useState<ProfileFeatureAvailability | null>(null);

  useEffect(() => {
    return setupDarkModeHotkey();
  }, []);

  const handleProfilesClick = () => {
    setCurrentPage("profiles");
    setProfileSheetRequestKey((current) => current + 1);
  };

  useEffect(() => {
    if (!activeProfile && settings?.default_profile) {
      setActiveProfile(settings.default_profile);
    }
  }, [activeProfile, settings?.default_profile]);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!settings?.valheim_mods_path || !activeProfile) {
        setFeatureAvailability(null);
        return;
      }

      try {
        const availability = await invoke<ProfileFeatureAvailability>(
          "get_profile_feature_availability",
          {
            modsPath: settings.valheim_mods_path,
            profile: activeProfile,
          }
        );
        setFeatureAvailability(availability);
      } catch {
        setFeatureAvailability(null);
      }
    };

    loadAvailability();
  }, [activeProfile, settings?.valheim_mods_path]);

  const hasFeatureOptions = Boolean(
    featureAvailability?.levelSettings.found || featureAvailability?.wackySpawners.found
  );

  useEffect(() => {
    if (currentPage === "level-spread" && !featureAvailability?.levelSettings.found) {
      setCurrentPage("profiles");
    }
    if (currentPage === "spawner-manager" && !featureAvailability?.wackySpawners.found) {
      setCurrentPage("profiles");
    }
  }, [
    currentPage,
    featureAvailability?.levelSettings.found,
    featureAvailability?.wackySpawners.found,
  ]);

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-auto overflow-y-auto">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute bottom-4 left-4 z-20"
        onClick={toggleDarkMode}
      >
        Toggle Theme (D)
      </Button>
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-primary tracking-tight">
            ⚔ r2auri
          </span>
          <span className="text-muted-foreground">
            Valheim Mod Profiler
          </span>
        </div>
        <nav className="flex gap-1">
          <Button
            size="sm"
            variant={currentPage === "profiles" ? "default" : "ghost"}
            onClick={handleProfilesClick}
          >
            Profiles
          </Button>
          <Button
            size="sm"
            variant={currentPage === "mods" ? "default" : "ghost"}
            onClick={() => setCurrentPage("mods")}
          >
            Mods
          </Button>
          <Button
            size="sm"
            variant={currentPage === "settings" ? "default" : "ghost"}
            onClick={() => setCurrentPage("settings")}
          >
            Settings
          </Button>
          <Select
            value=""
            onValueChange={(value) => {
              if (value === "level-spread" || value === "spawner-manager") {
                setCurrentPage(value);
              }
            }}
            disabled={!hasFeatureOptions}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Tools" />
            </SelectTrigger>
            <SelectContent>
              {featureAvailability?.levelSettings.found && (
                <SelectItem value="level-spread">Level Spread</SelectItem>
              )}
              {featureAvailability?.wackySpawners.found && (
                <SelectItem value="spawner-manager">Spawner Manager</SelectItem>
              )}
              {!hasFeatureOptions && (
                <SelectItem value="none" disabled>
                  No config tools for profile
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        {currentPage === "profiles" && (
          <ProfilesPage
            onNavigateToSettings={() => setCurrentPage("settings")}
            profileSheetRequestKey={profileSheetRequestKey}
            onSelectedProfileChange={setActiveProfile}
          />
        )}
        {currentPage === "mods" && <ModsPage />}
        {currentPage === "settings" && <SettingsPage />}
        {currentPage === "level-spread" && (
          <LevelSpreadPage configPath={featureAvailability?.levelSettings.filePath ?? null} />
        )}
        {currentPage === "spawner-manager" && (
          <SpawnerManagerPage configPath={featureAvailability?.wackySpawners.filePath ?? null} />
        )}
      </main>      <footer className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground print:hidden px-5 py-4 border-t border-border shrink-0">
        <HeartIcon size={16} strokeWidth={4} className="text-red-500" aria-hidden />
        <PlusIcon size={12} strokeWidth={4} className="text-slate-500" aria-hidden />
        <a
          href="https://github.com/dsthedev/r2auri"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
        >
          <CodeIcon size={18} strokeWidth={4} className="" aria-hidden />
          <span className="sr-only">Source code</span>
        </a>
      </footer>    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App;

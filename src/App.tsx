import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsProvider } from "@/contexts/settings-context";
import { SettingsPage } from "@/pages/settings-page";
import { ProfilesPage } from "@/pages/profiles-page";
import { setupDarkModeHotkey, toggleDarkMode } from "@/lib/utils";

import "./App.css";

type AppPage = "profiles" | "settings";

function AppContent() {
  const [currentPage, setCurrentPage] = useState<AppPage>("profiles");
  const [profileSheetRequestKey, setProfileSheetRequestKey] = useState(0);

  useEffect(() => {
    return setupDarkModeHotkey();
  }, []);

  const handleProfilesClick = () => {
    setCurrentPage("profiles");
    setProfileSheetRequestKey((current) => current + 1);
  };

  return (
    <div className="relative h-screen flex flex-col bg-background text-foreground">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute bottom-4 left-4 z-20"
        onClick={toggleDarkMode}
      >
        Toggle Theme (D)
      </Button>
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-card shrink-0">
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
            variant={currentPage === "settings" ? "default" : "ghost"}
            onClick={() => setCurrentPage("settings")}
          >
            Settings
          </Button>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        {currentPage === "profiles" && (
          <ProfilesPage
            onNavigateToSettings={() => setCurrentPage("settings")}
            profileSheetRequestKey={profileSheetRequestKey}
          />
        )}
        {currentPage === "settings" && <SettingsPage />}
      </main>
    </div>
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

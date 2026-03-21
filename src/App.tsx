import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileCompare } from "@/components/ux/profile-compare";
import { ProfileView } from "@/components/ux/profile-view";
import { setupDarkModeHotkey, toggleDarkMode } from "@/lib/utils";

import "./App.css";

function App() {
    const [profiles, setProfiles] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        invoke<string[]>("list_profiles")
            .then(setProfiles)
            .catch((e) => setError(String(e)));
    }, []);

    useEffect(() => {
        return setupDarkModeHotkey();
    }, []);

    return (
        <div className="relative h-screen flex flex-col bg-background text-foreground">
            <Button
                type="button"
                size="sm"
                variant="secondary"
                className="absolute top-2 right-3 z-20"
                onClick={toggleDarkMode}
            >
                Toggle Theme (D)
            </Button>
            <header className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-card shrink-0">
                <span className="text-base font-bold text-primary tracking-tight">⚔ r2auri</span>
                <span className="text-muted-foreground">Valheim Mod Profile Viewer</span>
            </header>

            <main className="flex-1 overflow-hidden px-5 py-3 flex flex-col max-w-5xl w-full mx-auto">
                {error && (
                    <Card className="ring-0 border border-destructive text-destructive text-sm px-3 py-2 mb-3">
                        Failed to load profiles: {error}
                    </Card>
                )}
                {profiles.length === 0 && !error ? (
                    <p className="text-sm text-muted-foreground text-center py-12">Loading profiles...</p>
                ) : (
                    <Tabs defaultValue="view" className="flex flex-col flex-1 overflow-hidden">
                        <TabsList className="mb-3 shrink-0">
                            <TabsTrigger value="view">View Profile</TabsTrigger>
                            <TabsTrigger value="compare">Compare Profiles</TabsTrigger>
                        </TabsList>
                        <TabsContent value="view" className="flex-1 overflow-hidden mt-0">
                            <ProfileView profiles={profiles} />
                        </TabsContent>
                        <TabsContent value="compare" className="flex-1 overflow-hidden mt-0">
                            <ProfileCompare profiles={profiles} />
                        </TabsContent>
                    </Tabs>
                )}
            </main>
        </div>
    );
}

export default App;

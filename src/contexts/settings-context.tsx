import { createContext, ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings } from "@/types/settings";

interface SettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (settings: AppSettings) => Promise<void>;
  refetch: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<AppSettings>("get_settings");
      setSettings(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSettings({
        valheim_mods_path: "",
        default_profile: "",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: AppSettings) => {
    try {
      setError(null);
      await invoke("set_settings", { settings: newSettings });
      setSettings(newSettings);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  };

  const refetch = () => fetchSettings();

  const value: SettingsContextType = {
    settings,
    loading,
    error,
    updateSettings,
    refetch,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

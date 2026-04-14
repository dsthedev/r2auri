import { useEffect, useState } from "react";
import type { PrefabCatalog } from "@/features/spawner-manager/types";

export function usePrefabData(): PrefabCatalog {
  const [creatures, setCreatures] = useState<string[]>([]);
  const [pieces, setPieces] = useState<string[]>([]);
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catalogResponse, imageResponse] = await Promise.all([
          fetch("/creatures-pieces.json"),
          fetch("/images_raw_urls.csv"),
        ]);

        const catalog = await catalogResponse.json();
        setCreatures(catalog.Creatures ?? []);
        setPieces(catalog.Pieces ?? []);

        const csvText = await imageResponse.text();
        const rows = csvText.trim().split("\n").slice(1);
        const nextMap = new Map<string, string>();

        for (const row of rows) {
          const separatorIndex = row.indexOf(",");
          if (separatorIndex === -1) {
            continue;
          }

          const filename = row.slice(0, separatorIndex).trim();
          const url = row.slice(separatorIndex + 1).trim();
          nextMap.set(filename.replace(/\.png$/i, ""), url);
        }

        setImageMap(nextMap);
      } catch {
        setCreatures([]);
        setPieces([]);
        setImageMap(new Map());
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  return { creatures, pieces, imageMap, loading };
}
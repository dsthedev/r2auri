export interface SpawnerObject {
  name: string;
  prefabToCopy?: string;
  m_spawnTimer?: number;
  m_onGroundOnly?: boolean;
  m_maxTotal?: number;
  m_maxNear?: number;
  m_farRadius?: number;
  m_spawnRadius?: number;
  m_setPatrolSpawnPoint?: boolean;
  m_triggerDistance?: number;
  m_spawnIntervalSec?: number;
  m_levelupChance?: number;
  m_prefabName?: string;
  m_nearRadius?: number;
  minLevel?: number;
  maxLevel?: number;
  HitPoints?: number;
  mobTarget?: boolean;
  multiSpawn?: number;
  [key: string]: unknown;
}

export interface PrefabCatalog {
  creatures: string[];
  pieces: string[];
  imageMap: Map<string, string>;
  loading: boolean;
}
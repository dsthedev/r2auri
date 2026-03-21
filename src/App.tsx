import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./App.css";

// ── Types ──────────────────────────────────────────────────────────────────

interface VersionNumber {
  major: number;
  minor: number;
  patch: number;
}

interface ModEntry {
  name: string;
  authorName: string;
  displayName: string;
  description: string;
  websiteUrl: string;
  versionNumber: VersionNumber;
  enabled: boolean;
  dependencies: string[];
  networkMode: string;
  packageType: string;
  installedAtTime: number | null;
  icon: string | null;
}

type FilterMode = "all" | "enabled" | "disabled";
type SortMode = "name" | "author" | "version";
type TabMode = "view" | "compare";

const versionStr = (v: VersionNumber) => `${v.major}.${v.minor}.${v.patch}`;

// ── ModCard ────────────────────────────────────────────────────────────────

function ModCard({ mod }: { mod: ModEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`mod-card${mod.enabled ? "" : " mod-disabled"}`}>
      <div className="mod-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="mod-icon-wrap">
          {mod.icon ? (
            <img src={mod.icon} alt="" className="mod-icon" />
          ) : (
            <div className="mod-icon-placeholder">?</div>
          )}
        </div>
        <div className="mod-card-info">
          <div className="mod-display-name">{mod.displayName}</div>
          <div className="mod-author">by {mod.authorName}</div>
        </div>
        <div className="mod-card-right">
          <span className="mod-version">v{versionStr(mod.versionNumber)}</span>
          <span className={`mod-status-dot ${mod.enabled ? "dot-enabled" : "dot-disabled"}`} />
        </div>
        <span className="mod-expand-icon">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="mod-card-body">
          <p className="mod-description">{mod.description}</p>
          {mod.dependencies.length > 0 && (
            <div className="mod-deps">
              <strong>Dependencies:</strong>
              <div className="dep-list">
                {mod.dependencies.map((d) => (
                  <span key={d} className="dep-tag">{d}</span>
                ))}
              </div>
            </div>
          )}
          <a
            className="mod-link"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openUrl(mod.websiteUrl);
            }}
          >
            View on Thunderstore ↗
          </a>
        </div>
      )}
    </div>
  );
}

// ── ProfileView ────────────────────────────────────────────────────────────

function ProfileView({ profiles }: { profiles: string[] }) {
  const [selectedProfile, setSelectedProfile] = useState<string>(profiles[0] ?? "");
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("name");

  useEffect(() => {
    if (!selectedProfile) return;
    setLoading(true);
    setError(null);
    invoke<ModEntry[]>("get_profile_mods", { profile: selectedProfile })
      .then(setMods)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selectedProfile]);

  const filtered = useMemo(() => {
    let result = [...mods];
    if (filter === "enabled") result = result.filter((m) => m.enabled);
    if (filter === "disabled") result = result.filter((m) => !m.enabled);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.authorName.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      if (sort === "author") return a.authorName.localeCompare(b.authorName);
      if (sort === "version")
        return versionStr(b.versionNumber).localeCompare(versionStr(a.versionNumber));
      return 0;
    });
    return result;
  }, [mods, filter, search, sort]);

  const enabledCount = mods.filter((m) => m.enabled).length;
  const disabledCount = mods.length - enabledCount;

  return (
    <div className="tab-content">
      <div className="toolbar">
        <div className="toolbar-left">
          <label className="toolbar-label">Profile</label>
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="select"
          >
            {profiles.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {mods.length > 0 && (
          <div className="mod-stats">
            <span className="stat-total">{mods.length} mods</span>
            <span className="stat-enabled">{enabledCount} enabled</span>
            <span className="stat-disabled">{disabledCount} disabled</span>
          </div>
        )}
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search mods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as FilterMode)} className="select">
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="select">
          <option value="name">Sort: Name</option>
          <option value="author">Sort: Author</option>
          <option value="version">Sort: Version</option>
        </select>
        {search && (
          <span className="search-result-count">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {loading && <div className="loading">Loading mods…</div>}
      {error && <div className="error">Error: {error}</div>}
      <div className="mod-list">
        {filtered.map((mod) => (
          <ModCard key={mod.name} mod={mod} />
        ))}
      </div>
    </div>
  );
}

// ── CompareSection ─────────────────────────────────────────────────────────

function CompareSection({
  title,
  mods,
  colorClass,
  showVersionDiff = false,
  otherVersions,
}: {
  title: string;
  mods: ModEntry[];
  colorClass: string;
  showVersionDiff?: boolean;
  otherVersions?: Map<string, string>;
}) {
  if (mods.length === 0) return null;
  return (
    <div className={`compare-section ${colorClass}`}>
      <div className="compare-section-title">
        {title}
        <span className="compare-count">{mods.length}</span>
      </div>
      <div className="compare-mod-list">
        {mods.map((mod) => (
          <div key={mod.name} className="compare-mod-item">
            {mod.icon && <img src={mod.icon} alt="" className="compare-mod-icon" />}
            <div className="compare-mod-info">
              <span className="compare-mod-name">{mod.displayName}</span>
              <span className="compare-mod-author">{mod.authorName}</span>
            </div>
            <div className="compare-version-col">
              {showVersionDiff && otherVersions ? (
                <>
                  <span className="version-a">v{versionStr(mod.versionNumber)}</span>
                  <span className="version-arrow">→</span>
                  <span className="version-b">v{otherVersions.get(mod.name)}</span>
                </>
              ) : (
                <span className="compare-mod-version">v{versionStr(mod.versionNumber)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ProfileCompare ─────────────────────────────────────────────────────────

function ProfileCompare({ profiles }: { profiles: string[] }) {
  const [profileA, setProfileA] = useState<string>(profiles[0] ?? "");
  const [profileB, setProfileB] = useState<string>(profiles[1] ?? profiles[0] ?? "");
  const [modsA, setModsA] = useState<ModEntry[]>([]);
  const [modsB, setModsB] = useState<ModEntry[]>([]);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  useEffect(() => {
    if (!profileA) return;
    setLoadingA(true);
    invoke<ModEntry[]>("get_profile_mods", { profile: profileA })
      .then(setModsA)
      .catch(console.error)
      .finally(() => setLoadingA(false));
  }, [profileA]);

  useEffect(() => {
    if (!profileB) return;
    setLoadingB(true);
    invoke<ModEntry[]>("get_profile_mods", { profile: profileB })
      .then(setModsB)
      .catch(console.error)
      .finally(() => setLoadingB(false));
  }, [profileB]);

  const cmp = useMemo(() => {
    const mapA = new Map(modsA.map((m) => [m.name, m]));
    const mapB = new Map(modsB.map((m) => [m.name, m]));
    const onlyInA = modsA.filter((m) => !mapB.has(m.name));
    const onlyInB = modsB.filter((m) => !mapA.has(m.name));
    const inBoth = modsA.filter((m) => mapB.has(m.name));
    const diffs = inBoth.filter(
      (m) => versionStr(m.versionNumber) !== versionStr(mapB.get(m.name)!.versionNumber)
    );
    const bVersionsForDiffs = new Map(
      diffs.map((m) => [m.name, versionStr(mapB.get(m.name)!.versionNumber)])
    );
    const same = inBoth.filter(
      (m) => versionStr(m.versionNumber) === versionStr(mapB.get(m.name)!.versionNumber)
    );
    return { onlyInA, onlyInB, diffs, bVersionsForDiffs, same };
  }, [modsA, modsB]);

  const loading = loadingA || loadingB;
  const ready = modsA.length > 0 && modsB.length > 0;

  return (
    <div className="tab-content">
      <div className="toolbar">
        <div className="toolbar-selectors">
          <div className="selector-group">
            <label className="toolbar-label label-a">Profile A</label>
            <select value={profileA} onChange={(e) => setProfileA(e.target.value)} className="select">
              {profiles.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <span className="compare-arrow">⟷</span>
          <div className="selector-group">
            <label className="toolbar-label label-b">Profile B</label>
            <select value={profileB} onChange={(e) => setProfileB(e.target.value)} className="select">
              {profiles.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}

      {!loading && ready && (
        <>
          <div className="compare-summary">
            <div className="summary-stat"><span className="stat-num">{modsA.length}</span><span className="stat-lbl">mods in A</span></div>
            <div className="summary-stat"><span className="stat-num">{modsB.length}</span><span className="stat-lbl">mods in B</span></div>
            <div className="summary-stat stat-only-a"><span className="stat-num">{cmp.onlyInA.length}</span><span className="stat-lbl">only in A</span></div>
            <div className="summary-stat stat-only-b"><span className="stat-num">{cmp.onlyInB.length}</span><span className="stat-lbl">only in B</span></div>
            <div className="summary-stat stat-diff"><span className="stat-num">{cmp.diffs.length}</span><span className="stat-lbl">version diffs</span></div>
            <div className="summary-stat stat-same"><span className="stat-num">{cmp.same.length}</span><span className="stat-lbl">identical</span></div>
          </div>

          <div className="compare-panels">
            <CompareSection
              title={`Only in ${profileA}`}
              mods={cmp.onlyInA}
              colorClass="section-only-a"
            />
            <CompareSection
              title={`Only in ${profileB}`}
              mods={cmp.onlyInB}
              colorClass="section-only-b"
            />
            <CompareSection
              title="Version differences"
              mods={cmp.diffs}
              colorClass="section-diff"
              showVersionDiff={true}
              otherVersions={cmp.bVersionsForDiffs}
            />
          </div>

          {cmp.same.length > 0 && (
            <details className="same-section">
              <summary>Common mods ({cmp.same.length})</summary>
              <div style={{ padding: "0 0 8px" }}>
                <CompareSection
                  title="Identical in both profiles"
                  mods={cmp.same}
                  colorClass="section-same"
                />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [tab, setTab] = useState<TabMode>("view");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<string[]>("list_profiles")
      .then(setProfiles)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-icon">⚔</span>
          r2auri
          <span className="app-subtitle">Valheim Mod Profile Viewer</span>
        </div>
        <nav className="app-nav">
          <button
            className={`nav-btn${tab === "view" ? " nav-btn-active" : ""}`}
            onClick={() => setTab("view")}
          >
            View Profile
          </button>
          <button
            className={`nav-btn${tab === "compare" ? " nav-btn-active" : ""}`}
            onClick={() => setTab("compare")}
          >
            Compare Profiles
          </button>
        </nav>
      </header>

      <main className="app-main">
        {error && <div className="error">Failed to load profiles: {error}</div>}
        {profiles.length === 0 && !error ? (
          <div className="loading">Loading profiles…</div>
        ) : tab === "view" ? (
          <ProfileView profiles={profiles} />
        ) : (
          <ProfileCompare profiles={profiles} />
        )}
      </main>
    </div>
  );
}

export default App;

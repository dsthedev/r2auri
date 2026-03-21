# r2auri

Welcome to r2auri, a desktop Valheim mod profile viewer and comparer built with Tauri + React.

r2auri reads your r2modman Valheim profiles, shows installed mods per profile, and helps you compare two profiles to find missing mods and version differences.

![r2auri screenshot](public/r2auri.png)

## What This App Does

- Lists available Valheim profiles found in your r2modman profiles directory.
- Shows all mods in a selected profile with search, filter, and sorting.
- Displays mod metadata such as author, version, enabled state, dependencies, and Thunderstore link.
- Compares two profiles and highlights:
- Mods only in Profile A
- Mods only in Profile B
- Mods present in both but with different versions

## Expected Default Path

By default, r2auri reads profiles from:

`~/.config/r2modmanPlus-local/Valheim/profiles`

Each profile is expected to contain a `mods.yml` file.

## How To Use

1. Launch the app.
2. In View Profile, pick a profile from the dropdown.
3. Use search, filter, and sort controls to inspect the mod list.
4. Expand a mod row to view description, dependencies, and open its Thunderstore page.
5. Open Compare Profiles, select Profile A and Profile B, then review differences and shared mods.

## Build For Linux

These instructions are for Linux (your current platform).

1. Install system dependencies (example for Debian/Ubuntu):

```bash
sudo apt update
sudo apt install -y \
	libwebkit2gtk-4.1-dev \
	libgtk-3-dev \
	libayatana-appindicator3-dev \
	librsvg2-dev \
	patchelf \
	build-essential \
	curl \
	wget \
	file \
	libssl-dev
```

2. Install Rust toolchain (if not already installed):

```bash
curl https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env"
```

3. Install Node.js + pnpm (if needed), then install project dependencies:

```bash
pnpm install
```

4. Run in development mode:

```bash
pnpm tauri dev
```

5. Build a release bundle:

```bash
pnpm tauri build
```

Build output is generated under `src-tauri/target/release/bundle`.

# Periodic Table

A desktop periodic table: click any of the 118 elements to see its facts in a side panel, styled like the interactive widget Google shows for "periodic table." Built the same way as its sibling project, [Latex-Floater](../Latex-Floater) — Tauri 2 shell, vanilla JS frontend, same battle-pass system — but as a normal resizable window rather than a floater, since a full grid plus a detail panel needs real room. Runs on Windows and macOS.

## What's in the box

- A full 18×10 periodic table grid, colour-coded by category (alkali metals, transition metals, noble gases, lanthanides, actinides, and so on), with the lanthanide/actinide rows pulled out below the main block the way every standard chart draws them
- Click any element for its knowledge panel: category, group/period/block, phase at room temperature, atomic mass, density, melting and boiling points, electron configuration, electronegativity, who discovered and named it, and a short one-line summary
- A legend and a permanent side panel — the panel stays visible the whole time so you can click through elements one after another without opening or closing anything
- Light/dark theme toggle and an opacity slider in the titlebar
- A battle pass. Viewing each element's knowledge panel for the first time earns XP — fifty levels, a theme unlocked every five levels, Gold at 50, LaTeX coins in between (yes, the currency is still called that; it's the same panel from Latex-Floater). View all 118 elements and you'll comfortably reach level 50. Pick unlocked themes from the paint-brush menu in the titlebar; Ctrl+Shift+Alt+L maxes the pass and Ctrl+Shift+Alt+R resets it (and clears which elements you've viewed)

## Where the data comes from

Element facts are pulled from [Bowserinator/Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON), a widely-used public dataset, via `scripts/build-data.js` — a one-off script, not something that runs at app startup or build time. It keeps only the structured factual fields (name, category, group, period, atomic mass, and so on — facts aren't copyrighted) and writes a short original one-sentence summary per element from those facts, rather than reusing the dataset's own prose or bundling its photos, since those carry unclear licensing. Regenerate `src/data/elements.json` with:

```sh
npm run build-data
```

You shouldn't need to — it's already committed — unless the upstream dataset changes.

## Installing a release

Grab the installer for your platform from the `src-tauri/target/release/bundle/` output of a build and run it. Windows gets an NSIS `.exe` installer (and an `.msi`), macOS gets a `.dmg`. The app is a few megabytes because it uses the web view your operating system already has (WebView2 on Windows, WebKit on macOS) instead of shipping a browser of its own.

On Windows 10, if the installer says WebView2 is missing, it will fetch it; Windows 11 has it built in.

## Building from source

You need [Node.js](https://nodejs.org/) 18 or newer and the [Rust toolchain](https://rustup.rs/). On Windows, Rust also needs the "Desktop development with C++" workload from the Visual Studio Build Tools; on macOS, run `xcode-select --install` once.

```sh
cd periodic-table
npm install
npm run dev      # run it, with hot reload of the frontend
npm run build    # produce installers in src-tauri/target/release/bundle/
```

The first `npm run dev` or `npm run build` compiles the Rust side, which takes a few minutes; after that it's seconds. There's no vendoring step here — this project has no third-party JS beyond `elements.json`, which is already committed.

## Usage notes

- **Pin button** (top-right, amber when active) toggles always-on-top — off by default, unlike Latex-Floater, since this is a normal window you'll likely switch away from.
- **The whole top bar is draggable** — grab it to reposition the window.
- **Window resizes normally** from any edge. Minimum size is 700×500.
- **Drag-resize remembers** the new size between sessions.
- **Battle pass track**: opening it grows the window if there isn't enough room, and closing it restores the window to exactly what it was before — repeatable without drift.

## File layout

```
periodic-table/
  package.json
  scripts/build-data.js    ← one-off: fetches and transforms the source dataset into src/data/elements.json
  src/                     ← the frontend, bundled as-is into the app
    index.html             ← UI markup
    styles.css             ← Dark/light theme, category swatch colours, IBM Plex typography
    bridge.js              ← window.floater: window chrome, opacity, resize/bounds for the battle pass
    data/elements.json     ← generated, committed — the 118-element dataset
    periodic-table.js      ← the grid: renders elements.json, handles clicks
    knowledge-panel.js     ← the side panel: formats and shows a selected element's facts
    themes.js              ← the ten battle-pass theme palettes (carried over from Latex-Floater)
    battlepass.js          ← XP, levels, the reward track, the theme picker (carried over, retargeted)
    app.js                 ← titlebar wiring: pin, minimize/close, theme toggle, opacity slider
    fonts/                 ← IBM Plex, self-hosted
  src-tauri/               ← the native shell (Rust)
    src/lib.rs             ← the one opacity command, window-size clamp on boot, plugin setup
    tauri.conf.json        ← window definition, bundle settings
    capabilities/          ← what the frontend is allowed to ask the native side for
```

## Notes

No parameter sliders (any letter besides the element data itself becoming interactive) and no cloud sync — everything is local, the same as Latex-Floater. Battle-pass XP and unlocked themes don't follow you between machines.

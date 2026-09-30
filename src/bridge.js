// src/bridge.js — the renderer's only contact with the native side.
//
// Same seam pattern as Latex-Floater: app.js and the other renderer files
// are written entirely against window.floater, built here on top of
// window.__TAURI__ (enabled by withGlobalTauri in tauri.conf.json). Smaller
// surface than Latex-Floater's copy — no clipboard, no PNG rendering,
// nothing to export here — just window chrome and opacity.

const { invoke } = window.__TAURI__.core;
const appWindow = window.__TAURI__.window.getCurrentWindow();

// Pin state lives here in localStorage, not native settings: the window is
// NOT always-on-top by default (unlike Latex-Floater — this is a normal
// window you'd want to switch away from), and the saved preference is
// re-applied on boot below.
let pinned = localStorage.getItem('pinned') === 'true';

window.floater = {
  togglePin: async () => {
    pinned = !pinned;
    localStorage.setItem('pinned', pinned);
    await appWindow.setAlwaysOnTop(pinned);
    return pinned;
  },
  getPinState: async () => pinned,

  minimize: () => appWindow.minimize(),
  close:    () => appWindow.close(),

  setOpacity: (value) => invoke('set_opacity', { value }),

  // Grow the window height by `deltaPx` CSS pixels, width kept. Used when
  // the battle pass track expands in a window too short to hold it. A
  // window sitting low on the screen would grow straight off the bottom, so
  // after growing, the window is nudged up as far as needed to keep its
  // bottom edge inside the monitor's work area.
  resizeBy: async (deltaPx) => {
    const { LogicalSize, LogicalPosition, currentMonitor } = window.__TAURI__.window;
    const scale = await appWindow.scaleFactor();
    const size = (await appWindow.innerSize()).toLogical(scale);
    await appWindow.setSize(new LogicalSize(size.width, Math.max(500, size.height + deltaPx)));
    if (deltaPx <= 0) return;
    const monitor = await currentMonitor();
    if (!monitor) return;
    const area = monitor.workArea || { position: monitor.position, size: monitor.size };
    const areaTop = area.position.y / scale;
    const areaBottom = (area.position.y + area.size.height) / scale;
    const pos = (await appWindow.outerPosition()).toLogical(scale);
    const outer = (await appWindow.outerSize()).toLogical(scale);
    const overflow = pos.y + outer.height - areaBottom;
    if (overflow > 0) await appWindow.setPosition(new LogicalPosition(pos.x, Math.max(areaTop, pos.y - overflow)));
  },

  // Reads the window's current outer Y position and inner height, in CSS
  // pixels — a snapshot taken right before growing it (battlepass.js's
  // setOpen()), to be handed back to restoreBounds() later.
  getBounds: async () => {
    const scale = await appWindow.scaleFactor();
    return {
      y: (await appWindow.outerPosition()).toLogical(scale).y,
      height: (await appWindow.innerSize()).toLogical(scale).height
    };
  },

  // Sets the window back to an exact {y, height} snapshot from getBounds() —
  // see the comment on this same function in Latex-Floater's bridge.js for
  // why an exact remembered value is used instead of reversing the grow
  // arithmetically (repeated relative resizes can drift at non-100% display
  // scaling).
  restoreBounds: async ({ y, height }) => {
    const { LogicalSize, LogicalPosition } = window.__TAURI__.window;
    const scale = await appWindow.scaleFactor();
    const width = (await appWindow.innerSize()).toLogical(scale).width;
    await appWindow.setSize(new LogicalSize(width, height));
    const x = (await appWindow.outerPosition()).toLogical(scale).x;
    await appWindow.setPosition(new LogicalPosition(x, y));
  },

  // Lower bound on the window height in CSS pixels (width stays at
  // minWidth). Used while the battle pass track is open so the window can't
  // be shrunk below what the layout needs.
  setMinHeight: (h) => {
    const { LogicalSize } = window.__TAURI__.window;
    return appWindow.setMinSize(new LogicalSize(700, h));
  },

  platform: navigator.platform
};

appWindow.setAlwaysOnTop(pinned);

// WebView2 and WKWebView both offer a browser context menu (Reload,
// Inspect…) on right-click. Nothing in this UI wants one.
document.addEventListener('contextmenu', (e) => e.preventDefault());

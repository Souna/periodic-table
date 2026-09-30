// src/app.js — boots the titlebar wiring.
//
// The grid and knowledge panel boot themselves (periodic-table.js,
// knowledge-panel.js); the battle pass boots itself too (battlepass.js).
// This file is only the titlebar: pin, minimize/close, theme toggle,
// opacity slider, and the shared updateMinHeight() battlepass.js calls when
// its track opens or closes. No font-size controls and no history clock
// here — carried over from Latex-Floater's app.js, trimmed to what applies
// (no math field, no graph panel, so no GRAPH_HEIGHT/ensureGraphRoom
// equivalent is needed).

// ---------------------------------------------------------------------------
// Window chrome buttons.
// ---------------------------------------------------------------------------

const pinBtn = document.getElementById('btn-pin');

function applyPinState(isPinned) {
  pinBtn.classList.toggle('is-active', isPinned);
  pinBtn.title = isPinned ? 'Unpin (always on top: ON)' : 'Pin (always on top: OFF)';
}

pinBtn.addEventListener('click', async () => {
  applyPinState(await window.floater.togglePin());
});
window.floater.getPinState().then(applyPinState);

document.getElementById('btn-minimize').addEventListener('click', () => window.floater.minimize());
document.getElementById('btn-close').addEventListener('click', () => window.floater.close());

// ---------------------------------------------------------------------------
// Minimum window height. Only the battle pass track affects this here (there
// is no graph panel) — 500 matches MIN_HEIGHT in tauri.conf.json / lib.rs.
// ---------------------------------------------------------------------------

function updateMinHeight() {
  const pass = window.BattlePass;
  const min = 500 + (pass.isOpen() ? pass.trackHeight : 0);
  return window.floater.setMinHeight(Math.ceil(min));
}
window.updateMinHeight = updateMinHeight;

// ---------------------------------------------------------------------------
// Themes. The palettes and the mechanics of applying one live in themes.js;
// the battle pass decides which are unlocked and owns the paint-brush
// dropdown. Here: just the sun/moon toggle and its icon.
// ---------------------------------------------------------------------------

const iconSun  = document.getElementById('icon-sun');
const iconMoon = document.getElementById('icon-moon');

document.addEventListener('themechange', ({ detail }) => {
  const isLight = detail.mode === 'light';
  iconSun.style.display  = isLight ? 'none'  : '';
  iconMoon.style.display = isLight ? ''      : 'none';
});

{
  // Older Latex-Floater builds stored 'dark' / 'light' as the theme itself;
  // those are now the two modes of Default. Carried over defensively even
  // though this is a fresh project with no such legacy values.
  let saved = localStorage.getItem('theme') || 'default';
  let mode = localStorage.getItem('themeMode') || 'dark';
  if (saved === 'dark' || saved === 'light') { mode = saved; saved = 'default'; }
  window.Themes.apply(window.BattlePass.isUnlocked(saved) ? saved : 'default', mode);
}

document.getElementById('btn-theme').addEventListener('click', () => {
  window.Themes.toggleMode();
});

// ---------------------------------------------------------------------------
// Opacity slider.
// ---------------------------------------------------------------------------

const opacitySlider = document.getElementById('opacity-slider');
opacitySlider.value = Math.round((parseFloat(localStorage.getItem('opacity') || '1')) * 100);

opacitySlider.addEventListener('input', () => {
  const value = opacitySlider.value / 100;
  window.floater.setOpacity(value);
  localStorage.setItem('opacity', value);
});

// ---------------------------------------------------------------------------
// Boot.
// ---------------------------------------------------------------------------

window.floater.setOpacity(parseFloat(localStorage.getItem('opacity') || '1'));
updateMinHeight();

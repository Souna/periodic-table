// src/battlepass.js — the battle pass, carried over from Latex-Floater.
//
// Same engine (level maths, 50-level track UI, theme-unlock schedule, theme
// picker dropdown, coin count, dev shortcuts) — see that project's copy for
// the original design rationale. What's different here is the XP trigger:
// viewing an element's knowledge panel for the first time earns XP, once
// per element ever (a permanent "viewed" set, not just "not the same as the
// last one" — with a fixed 118-element table, "collect them all" is the
// natural anti-farm, unlike Latex-Floater's open-ended stream of expressions
// where only an immediate repeat was excluded). XP per element is flat and
// tuned so that viewing every element carries you through all 50 levels:
// 118 elements x 150 XP = 17,700, comfortably over the ~16,170 total the
// level curve (xpToNext, unchanged from Latex-Floater) needs to reach 50 —
// there's no equivalent "how complex was this" signal an element could be
// scored on the way a LaTeX expression's length/structure was.
//
// This file owns the XP rules, the level maths, the track UI (a horizontal
// path in a collapsible strip at the very bottom of the window), the theme
// picker dropdown in the titlebar, and the coin count. Persistent state is
// one number (total XP) plus the set of viewed element numbers — levels,
// coins and unlocks all derive from XP, so nothing can drift.

(function () {
  'use strict';

  const MAX_LEVEL = 50;
  const THEME_LEVELS = { 5: 'slate', 10: 'nebula', 15: 'forest', 20: 'synthwave', 25: 'sepia',
                         30: 'blueprint', 35: 'rose', 40: 'terminal', 45: 'ocean', 50: 'gold' };
  const UNIQUE_LEVELS = new Set([10, 20, 30, 40]);
  const PASS_HEIGHT = 156;      // expanded track height, css px (matches .pass__track-wrap)
  const XP_PER_ELEMENT = 150;   // flat award for viewing a not-yet-viewed element

  // XP needed to go from level L to L+1 — unchanged from Latex-Floater.
  const xpToNext = (L) => 80 + 10 * L;

  function rewardFor(level) {
    const theme = THEME_LEVELS[level];
    if (theme) return { type: 'theme', id: theme, unique: UNIQUE_LEVELS.has(level), gold: level === MAX_LEVEL };
    return { type: 'coins', amount: 20 + level };
  }

  // ---------------------------------------------------------------- state

  let xp = parseInt(localStorage.getItem('bpXp') || '0', 10) || 0;
  let viewed = new Set(JSON.parse(localStorage.getItem('bpViewed') || '[]'));
  // Always starts collapsed: unlike a panel you work in, the pass isn't
  // something a relaunch should bring back up. Any window growth from a
  // previous session is simply kept as the window's size — so preGrowBounds
  // here is in-memory only, nothing to persist across a relaunch that always
  // starts with the track collapsed anyway.
  let open = false;
  let preGrowBounds = null;
  localStorage.setItem('bpOpen', 'false');

  function levelInfo() {
    let level = 1, into = xp;
    while (level < MAX_LEVEL && into >= xpToNext(level)) { into -= xpToNext(level); level++; }
    return { level, into, need: level < MAX_LEVEL ? xpToNext(level) : 0 };
  }

  function coins() {
    const { level } = levelInfo();
    let total = 0;
    for (let L = 2; L <= level; L++) { const r = rewardFor(L); if (r.type === 'coins') total += r.amount; }
    return total;
  }

  function themeLevel(id) {
    for (const [L, t] of Object.entries(THEME_LEVELS)) if (t === id) return Number(L);
    return 0;   // Dark and Light: always available
  }
  const isUnlocked = (id) => themeLevel(id) <= levelInfo().level;

  // ------------------------------------------------------------ elements

  const panel     = document.getElementById('pass');
  const bar       = panel.querySelector('.pass__bar');
  const levelEl   = document.getElementById('pass-level');
  const xpEl      = document.getElementById('pass-xp');
  const fillEl    = document.getElementById('pass-xpfill');
  const gainEl    = document.getElementById('pass-gain');
  const toggleBtn = document.getElementById('pass-toggle');
  const trackWrap = document.getElementById('pass-track-wrap');
  const track     = document.getElementById('pass-track');
  const coinEl    = document.getElementById('coin-count');
  const paletteBtn = document.getElementById('btn-palette');
  const menu      = document.getElementById('theme-menu');
  const tableViewEl = document.querySelector('.table-view');

  // -------------------------------------------------------------- track

  const nodes = [];

  function buildTrack() {
    track.textContent = '';
    for (let L = 1; L <= MAX_LEVEL; L++) {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'pass__node';
      node.dataset.level = L;
      const reward = L === 1 ? null : rewardFor(L);
      let icon = '', label = 'Start';
      if (reward && reward.type === 'theme') {
        const theme = window.Themes.THEMES[reward.id];
        node.classList.add('is-theme');
        if (reward.unique) node.classList.add('is-unique');
        if (reward.gold) node.classList.add('is-gold');
        icon = `<span class="pass__swatch" style="--swatch:${theme.vars.accent}; --swatch-bg:${theme.vars.bg}"></span>`;
        label = theme.name;
        node.title = `Level ${L}: the ${theme.name} theme` + (theme.blurb ? ` — ${theme.blurb}` : '');
      } else if (reward) {
        icon = coinSvg();
        label = '';
        node.title = `Level ${L}: ${reward.amount} coins`;
      } else {
        node.title = 'Level 1';
      }
      node.innerHTML = `<span class="pass__reward">${icon}</span><span class="pass__dot">${L}</span><span class="pass__label">${label}</span>`;
      track.appendChild(node);
      nodes.push(node);
    }
    const fill = document.createElement('div');
    fill.className = 'pass__fill';
    fill.id = 'pass-fill';
    track.appendChild(fill);
  }

  // A coin is gold whatever the theme; it's a coin.
  function coinSvg() {
    return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#d4a45c" stroke="#e0b472"/><text x="8" y="11.2" text-anchor="middle" font-size="8.5" font-family="IBM Plex Mono, monospace" font-weight="600" fill="#1a1308">L</text></svg>';
  }

  // The track has no scrollbar: the wheel scrolls it sideways, and dragging
  // pans it. A drag that moved more than a few pixels swallows the click
  // that ends it, so panning across a theme node doesn't apply the theme.
  let pan = null, panned = false;
  trackWrap.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();
    trackWrap.scrollLeft += (e.deltaX || e.deltaY);
  }, { passive: false });
  trackWrap.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    pan = { x: e.clientX, left: trackWrap.scrollLeft };
    panned = false;
    trackWrap.classList.add('is-panning');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!pan) return;
    const dx = e.clientX - pan.x;
    if (Math.abs(dx) > 4) panned = true;
    trackWrap.scrollLeft = pan.left - dx;
  });
  window.addEventListener('mouseup', () => { pan = null; trackWrap.classList.remove('is-panning'); });

  // Clicking an unlocked theme on the track applies it; anything else just
  // shows its title.
  track.addEventListener('click', (e) => {
    if (panned) { panned = false; return; }
    const node = e.target.closest('.pass__node');
    if (!node) return;
    const L = Number(node.dataset.level);
    const reward = L === 1 ? null : rewardFor(L);
    if (reward && reward.type === 'theme' && L <= levelInfo().level) window.Themes.apply(reward.id);
  });

  // ------------------------------------------------------------- render

  const FILL_MS = 300;   // matches the .pass__xpfill transition in styles.css
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function setFill(pct, animate = true) {
    fillEl.style.transition = animate ? '' : 'none';
    fillEl.style.width = pct + '%';
    if (!animate) { void fillEl.offsetWidth; fillEl.style.transition = ''; }
  }
  const currentFillPct = () => { const { level, into, need } = levelInfo(); return level < MAX_LEVEL ? (into / need) * 100 : 100; };

  // A level-up plays as a progression rather than a jump: the bar fills to
  // the end, the label ticks over, the bar snaps to empty without animating,
  // then rises to the new value — once per level gained.
  async function animateLevelUps(fromLevel, toLevel) {
    for (let L = fromLevel; L < toLevel; L++) {
      setFill(100);
      await wait(FILL_MS + 40);
      levelEl.textContent = `Level ${L + 1}`;
      setFill(0, false);
      await wait(30);
    }
    setFill(currentFillPct());
  }

  function render(withFill = true) {
    const { level, into, need } = levelInfo();
    levelEl.textContent = `Level ${level}`;
    xpEl.textContent = level < MAX_LEVEL ? `${into} / ${need} XP` : `${xp} XP · maxed`;
    if (withFill) setFill(currentFillPct());
    coinEl.textContent = coins();

    nodes.forEach((node, i) => {
      const L = i + 1;
      node.classList.toggle('is-done', L <= level);
      node.classList.toggle('is-current', L === level);
    });
    const fraction = level < MAX_LEVEL ? into / need : 0;
    const pct = ((level - 1 + fraction) / (MAX_LEVEL - 1)) * 100;
    const fill = document.getElementById('pass-fill');
    if (fill) fill.style.width = `calc(${pct}% )`;

    renderMenu();
  }

  let gainTimer = 0;
  function showGain(text) {
    gainEl.textContent = text;
    gainEl.hidden = false;
    gainEl.classList.remove('is-pop');
    void gainEl.offsetWidth;
    gainEl.classList.add('is-pop');
    clearTimeout(gainTimer);
    gainTimer = setTimeout(() => { gainEl.hidden = true; }, 1600);
  }

  // ------------------------------------------------------------- award

  // Called by knowledge-panel.js every time an element is shown. Only the
  // first-ever view of a given atomic number pays out — viewed is a
  // permanent set (persisted), not a single "last one" check, since with a
  // fixed 118-element table the natural anti-farm is "each one pays once,
  // ever," not "don't immediately repeat."
  function award(atomicNumber) {
    if (viewed.has(atomicNumber)) return;
    viewed.add(atomicNumber);
    localStorage.setItem('bpViewed', JSON.stringify([...viewed]));

    const gain = XP_PER_ELEMENT;
    const before = levelInfo().level;
    xp += gain;
    localStorage.setItem('bpXp', xp);
    const after = levelInfo().level;
    if (after > before) {
      render(false);
      levelEl.textContent = `Level ${before}`;
      animateLevelUps(before, after);
    } else {
      render();
    }
    showGain(`+${gain} XP`);
    for (let L = before + 1; L <= after; L++) {
      const r = rewardFor(L);
      const what = r.type === 'theme' ? `unlocked the ${window.Themes.THEMES[r.id].name} theme` : `+${r.amount} coins`;
      if (typeof flashStatus === 'function') flashStatus(`Level ${L}! ${what}`);
      panel.classList.remove('is-levelup');
      void panel.offsetWidth;
      panel.classList.add('is-levelup');
    }
    if (after > before && open) scrollToCurrent();
  }

  // --------------------------------------------------- expand / collapse

  function applyLayout(isOpen) {
    panel.classList.toggle('is-collapsed', !isOpen);
    trackWrap.hidden = !isOpen;
    toggleBtn.title = isOpen ? 'Collapse battle pass' : 'Expand battle pass';
  }

  function scrollToCurrent() {
    const node = nodes[levelInfo().level - 1];
    if (node) trackWrap.scrollLeft = node.offsetLeft - trackWrap.clientWidth / 2 + node.offsetWidth / 2;
  }

  // TABLE_MIN_HEIGHT is the periodic table view's own comfortable minimum —
  // must match --table-min-height in styles.css. Opening the track needs
  // PASS_HEIGHT of room; if the table view is already at or above its own
  // minimum (the common case), growing the window by exactly PASS_HEIGHT
  // is enough to add that without touching the table view's size at all —
  // if the window is currently small enough that the table view is already
  // below its minimum, the extra shortfall is grown too, so opening the
  // pass never squeezes the table smaller than it already was. Restored
  // exactly on collapse via preGrowBounds/restoreBounds (see bridge.js) so
  // opening and closing repeatedly can't drift the window's size.
  const TABLE_MIN_HEIGHT = 400;

  async function setOpen(isOpen) {
    open = isOpen;
    localStorage.setItem('bpOpen', isOpen);
    applyLayout(isOpen);
    if (isOpen) {
      const need = PASS_HEIGHT + Math.max(0, TABLE_MIN_HEIGHT - tableViewEl.clientHeight);
      if (need > 0) {
        if (!preGrowBounds) preGrowBounds = await window.floater.getBounds();
        await window.floater.resizeBy(need);
      }
      scrollToCurrent();
    } else if (preGrowBounds) {
      await window.floater.restoreBounds(preGrowBounds);
      preGrowBounds = null;
    }
    if (window.updateMinHeight) await window.updateMinHeight();
  }

  // Whole bar toggles the panel. Nothing else in it is a separate click
  // target, so no exclusion needed; toggleBtn itself is inside bar and
  // still works via bubbling, including keyboard-Enter activation.
  bar.addEventListener('click', () => setOpen(!open));

  // --------------------------------------------------------- theme menu

  function renderMenu() {
    const { THEMES } = window.Themes;
    const current = window.Themes.current();
    menu.textContent = '';
    for (const [id, theme] of Object.entries(THEMES)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu__item';
      item.dataset.id = id;
      const unlocked = isUnlocked(id);
      const level = themeLevel(id);
      item.disabled = !unlocked;
      item.classList.toggle('is-current', id === current);
      const mode = window.Themes.mode();
      const vars = window.Themes.varsFor(id, mode);
      const swatch = vars ? `--swatch:${vars.accent}; --swatch-bg:${vars.bg}`
                          : (mode === 'light' ? '--swatch:#a86e24; --swatch-bg:#f4f2ed' : '--swatch:#d4a45c; --swatch-bg:#12131a');
      item.innerHTML = `<span class="pass__swatch" style="${swatch}"></span><span class="menu__name">${theme.name}</span>` +
        (unlocked ? (id === current ? '<span class="menu__tag">current</span>' : '')
                  : `<span class="menu__tag menu__tag--lock">Lv ${level}</span>`);
      if (theme.blurb) item.title = theme.blurb;
      menu.appendChild(item);
    }
  }

  function openMenu() {
    renderMenu();
    const r = paletteBtn.getBoundingClientRect();
    menu.hidden = false;
    menu.style.top = (r.bottom + 4) + 'px';
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  }
  function closeMenu() { menu.hidden = true; }

  paletteBtn.addEventListener('click', (e) => { e.stopPropagation(); if (menu.hidden) openMenu(); else closeMenu(); });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.menu__item');
    if (!item || item.disabled) return;
    window.Themes.apply(item.dataset.id);
    closeMenu();
  });
  document.addEventListener('mousedown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== paletteBtn) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); e.stopPropagation(); } }, true);
  document.addEventListener('themechange', renderMenu);

  // ------------------------------------------------------ dev shortcuts
  //
  // Ctrl+Shift+Alt+L maxes the pass and Ctrl+Shift+Alt+R resets it — for
  // trying the themes without clicking through most of the table first.
  // Resetting also clears the viewed set, so previously-viewed elements pay
  // out again. Deliberately awkward to press by accident; documented only
  // in CLAUDE.md and the README's small print.

  function setXp(value, note) {
    xp = Math.max(0, Math.min(value, totalXp()));
    localStorage.setItem('bpXp', xp);
    render();
    if (open) scrollToCurrent();
    if (typeof flashStatus === 'function') flashStatus(note);
  }
  function totalXp() { let t = 0; for (let L = 1; L < MAX_LEVEL; L++) t += xpToNext(L); return t; }

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey && e.shiftKey && e.altKey)) return;
    if (e.key.toLowerCase() === 'l') { e.preventDefault(); setXp(totalXp(), 'battle pass maxed (dev)'); }
    else if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      viewed = new Set();
      localStorage.setItem('bpViewed', '[]');
      setXp(0, 'battle pass reset (dev)');
    }
  }, true);

  // --------------------------------------------------------------- boot

  buildTrack();
  render();
  applyLayout(open);

  window.BattlePass = { award, levelInfo, coins, isUnlocked, setOpen, isOpen: () => open, hasViewed: (n) => viewed.has(n), trackHeight: PASS_HEIGHT };
})();

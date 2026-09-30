// src/knowledge-panel.js — window.KnowledgePanel, the fixed side panel.
//
// A permanent panel next to the grid, not an overlay like Latex-Floater's
// history box: the window is wide enough for both at once, and browsing
// through many elements in a row is the whole point, so a toggle would just
// get in the way. Loaded before periodic-table.js so PeriodicTable.select()
// can call KnowledgePanel.show() unconditionally as soon as a cell is
// clicked; it starts out showing the placeholder from index.html.

(function () {
  'use strict';

const CATEGORY_CLASS = {
  'Alkali metals': 'alkali',
  'Alkaline earth metals': 'alkaline-earth',
  'Transition metals': 'transition',
  'Post-transition metals': 'post-transition',
  'Metalloids': 'metalloid',
  'Reactive nonmetals': 'reactive-nonmetal',
  'Noble gases': 'noble-gas',
  'Lanthanides': 'lanthanide',
  'Actinides': 'actinide',
  'Unknown properties': 'unknown'
};

function fmt(value, unit) {
  return value === null || value === undefined ? '—' : `${value}${unit}`;
}

function kelvinToCelsius(k) {
  return k === null || k === undefined ? null : Math.round((k - 273.15) * 10) / 10;
}

function show(el) {
  const placeholder = document.getElementById('kp-placeholder');
  const content = document.getElementById('kp-content');
  placeholder.hidden = true;
  content.hidden = false;

  const cls = CATEGORY_CLASS[el.category] || 'unknown';
  const melt = kelvinToCelsius(el.melt);
  const boil = kelvinToCelsius(el.boil);

  content.innerHTML = `
    <div class="kp-header kp-header--${cls}">
      <span class="kp-header__number">${el.number}</span>
      <span class="kp-header__symbol">${el.symbol}</span>
      <span class="kp-header__name">${el.name}</span>
      <span class="kp-header__category">${el.category}</span>
    </div>
    <p class="kp-summary">${el.summary}</p>
    <dl class="kp-facts">
      <div class="kp-facts__row"><dt>Group / Period / Block</dt><dd>${fmt(el.group, '')} / ${fmt(el.period, '')} / ${fmt(el.block, '')}</dd></div>
      <div class="kp-facts__row"><dt>Phase at room temp.</dt><dd>${el.phase}</dd></div>
      <div class="kp-facts__row"><dt>Atomic mass</dt><dd>${fmt(el.atomic_mass, ' u')}</dd></div>
      <div class="kp-facts__row"><dt>Density</dt><dd>${fmt(el.density, ' g/cm³')}</dd></div>
      <div class="kp-facts__row"><dt>Melting point</dt><dd>${melt === null ? '—' : `${melt} °C`}</dd></div>
      <div class="kp-facts__row"><dt>Boiling point</dt><dd>${boil === null ? '—' : `${boil} °C`}</dd></div>
      <div class="kp-facts__row"><dt>Electron configuration</dt><dd>${fmt(el.electron_configuration, '')}</dd></div>
      <div class="kp-facts__row"><dt>Electronegativity (Pauling)</dt><dd>${fmt(el.electronegativity_pauling, '')}</dd></div>
      <div class="kp-facts__row"><dt>Discovered by</dt><dd>${fmt(el.discovered_by, '')}</dd></div>
      <div class="kp-facts__row"><dt>Named by</dt><dd>${fmt(el.named_by, '')}</dd></div>
    </dl>`;
}

window.KnowledgePanel = { show };

})();

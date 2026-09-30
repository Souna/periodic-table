// src/periodic-table.js — window.PeriodicTable, the grid itself.
//
// A CSS grid rather than canvas: crisp text at any zoom, easy click
// targets, and cell backgrounds can just be CSS variables so every battle-
// pass theme recolors the categories for free, the same way Latex-Floater's
// theming reaches into MathQuill's DOM. Layout comes straight from each
// element's xpos/ypos in elements.json (Bowserinator/Periodic-Table-JSON's
// own layout numbers): rows 1-7 are the main 18-column block, row 8 is
// intentionally empty (the visual gap above the f-block), and rows 9-10 are
// the lanthanide/actinide strip — no separate "widescreen" field needed,
// this is already the pulled-out layout every standard chart uses.

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

// Legend order follows the plan's own listing (roughly metallic-to-nonmetallic
// across the table, matching the reading order of Google's own legend).
const LEGEND_ORDER = [
  'Alkali metals', 'Alkaline earth metals', 'Transition metals',
  'Post-transition metals', 'Metalloids', 'Reactive nonmetals',
  'Noble gases', 'Lanthanides', 'Actinides', 'Unknown properties'
];

let elements = [];
let selectedNumber = null;

function cellHTML(el) {
  const cls = CATEGORY_CLASS[el.category] || 'unknown';
  return `
    <button type="button" class="element-cell element-cell--${cls}"
            style="grid-column:${el.xpos};grid-row:${el.ypos}"
            data-number="${el.number}"
            title="${el.name}"
            aria-label="${el.name}, element ${el.number}">
      <span class="element-cell__number">${el.number}</span>
      <span class="element-cell__symbol">${el.symbol}</span>
    </button>`;
}

function render() {
  const grid = document.getElementById('element-grid');
  grid.innerHTML = elements.map(cellHTML).join('');
  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.element-cell');
    if (cell) select(Number(cell.dataset.number));
  });

  const legend = document.getElementById('legend');
  legend.innerHTML = LEGEND_ORDER.map((cat) => `
    <div class="legend__item">
      <span class="legend__swatch legend__swatch--${CATEGORY_CLASS[cat]}"></span>
      <span>${cat}</span>
    </div>`).join('');
}

function select(number) {
  const el = elements.find((e) => e.number === number);
  if (!el) return;
  selectedNumber = number;
  document.querySelectorAll('.element-cell.is-selected').forEach((c) => c.classList.remove('is-selected'));
  document.querySelector(`.element-cell[data-number="${number}"]`)?.classList.add('is-selected');
  window.KnowledgePanel.show(el);
  window.BattlePass.award(number);
}

async function init() {
  const res = await fetch('data/elements.json');
  elements = await res.json();
  render();
}

init();

window.PeriodicTable = {
  select,
  getSelected: () => selectedNumber
};

})();

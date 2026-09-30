// scripts/build-data.js — one-off generator for src/data/elements.json.
//
// Run manually during setup (`node scripts/build-data.js`), not on every
// app build — the app itself has no network dependency, same reasoning as
// self-hosting the fonts in Latex-Floater. This fetches the source dataset
// once and writes a small, static, committed file.
//
// Source: github.com/Bowserinator/Periodic-Table-JSON — a widely-used
// community dataset. It also ships a prose "summary" field and photo URLs
// that read as adapted from Wikipedia/Wikimedia with mixed, unclear
// per-element licensing; this script deliberately drops both. Facts aren't
// copyrightable, so the numeric/structural fields are kept as-is, and a
// short one-line description is generated here from those facts instead of
// copied prose.
//
// Grid coordinates: the source's xpos/ypos give the standard "lanthanides
// and actinides pulled below the main block" layout (verified directly
// against the source data before writing this): columns 1-18 are the normal
// groups, rows 1-7 are the main periods, row 8 is a deliberate gap, rows 9
// and 10 are the lanthanide and actinide rows. Its wxpos/wypos fields are a
// different, 32-column "inline f-block" layout — not used here.

const SOURCE_URL = 'https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json';

// The source's ~14 fine-grained categories (for elements 1-118; a 15th,
// "unknown, but predicted to be an alkali metal", belongs to element 119,
// which isn't a confirmed element and is excluded below), mapped down to
// the 10 buckets Google's own periodic table widget legend uses.
const CATEGORY_MAP = {
  'alkali metal': 'Alkali metals',
  'alkaline earth metal': 'Alkaline earth metals',
  'transition metal': 'Transition metals',
  'post-transition metal': 'Post-transition metals',
  'metalloid': 'Metalloids',
  'diatomic nonmetal': 'Reactive nonmetals',
  'polyatomic nonmetal': 'Reactive nonmetals',
  'noble gas': 'Noble gases',
  'lanthanide': 'Lanthanides',
  'actinide': 'Actinides',
  'unknown, probably transition metal': 'Unknown properties',
  'unknown, probably post-transition metal': 'Unknown properties',
  'unknown, probably metalloid': 'Unknown properties',
  'unknown, predicted to be noble gas': 'Unknown properties'
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Singular form of each of the 10 mapped categories — a plain regex "strip
// trailing s" is wrong for "Unknown properties" (-> "propertie") and reads
// oddly for a category that isn't really a countable noun anyway, so it
// gets its own sentence shape entirely rather than forcing it through
// "a/an <category>".
const SINGULAR = {
  'Alkali metals': 'alkali metal',
  'Alkaline earth metals': 'alkaline earth metal',
  'Transition metals': 'transition metal',
  'Post-transition metals': 'post-transition metal',
  'Metalloids': 'metalloid',
  'Reactive nonmetals': 'reactive nonmetal',
  'Noble gases': 'noble gas',
  'Lanthanides': 'lanthanide',
  'Actinides': 'actinide'
};

function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

// Most discovered_by values are a person's or institution's name, for which
// "Discovered by X" reads fine. A handful (verified by listing every
// distinct value the dataset actually contains before writing this) are a
// date, era, or place instead, e.g. "5000 BC" or "Bronze Age" — "Discovered
// by 5000 BC" doesn't parse as a sentence, so those get their own phrasing.
const KNOWN_SINCE = {
  '5000 BC': 'Known since around 5000 BC.',
  'Bronze Age': 'Known since the Bronze Age.',
  'India': 'Known since ancient times in India.',
  'Middle East': 'Known since ancient times in the Middle East.',
  'Ancient Egypt': 'Known since ancient Egypt.',
  'Ancient china': 'Known since ancient China.'
};

function discoveryClause(discoveredBy) {
  if (!discoveredBy) return '';
  if (KNOWN_SINCE[discoveredBy]) return ` ${KNOWN_SINCE[discoveredBy]}`;
  const beforeEra = discoveredBy.match(/^unknown,\s*(before .+)/i);
  if (beforeEra) return ` Known since ${beforeEra[1]}.`;
  return ` Discovered by ${discoveredBy}.`;
}

// A short, original, entirely fact-derived sentence — not adapted from any
// source's prose. Every field it uses comes straight from the dataset's
// structured (non-prose) fields.
function summarize(el, category) {
  const singular = SINGULAR[category];
  const parts = [`${el.name} (${el.symbol}) is the ${ordinal(el.number)} element`];
  parts.push(singular ? `, ${article(singular)} ${singular}` : ', of unconfirmed chemical category');
  if (el.atomic_mass) parts.push(` with an atomic mass of ${round(el.atomic_mass, 3)} u`);
  let sentence = parts.join('') + '.';
  if (el.phase) sentence += ` ${el.phase} at room temperature.`;
  sentence += discoveryClause(el.discovered_by);
  return sentence;
}

function round(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const source = await res.json();

  const elements = source.elements
    .filter((el) => el.number >= 1 && el.number <= 118)
    .map((el) => {
      const category = CATEGORY_MAP[el.category];
      if (!category) throw new Error(`Unmapped category "${el.category}" for ${el.name} (#${el.number})`);
      const out = {
        number: el.number,
        symbol: el.symbol,
        name: el.name,
        category,
        group: el.group,
        period: el.period,
        block: el.block,
        phase: el.phase,
        atomic_mass: el.atomic_mass,
        density: el.density ?? null,
        melt: el.melt ?? null,
        boil: el.boil ?? null,
        electron_configuration: el.electron_configuration,
        electronegativity_pauling: el.electronegativity_pauling ?? null,
        discovered_by: el.discovered_by ?? null,
        named_by: el.named_by ?? null,
        xpos: el.xpos,
        ypos: el.ypos
      };
      out.summary = summarize(out, category);
      return out;
    })
    .sort((a, b) => a.number - b.number);

  if (elements.length !== 118) throw new Error(`Expected 118 elements, got ${elements.length}`);

  const outPath = new URL('../src/data/elements.json', import.meta.url);
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(outPath, JSON.stringify(elements, null, 2) + '\n', 'utf8')
  );
  console.log(`Wrote ${elements.length} elements to src/data/elements.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

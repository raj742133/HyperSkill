// Everything a config may leave out. A config of just { brand: { name: "Acme" } } must still generate a complete, sensible,
// working site. Strings may use {brand} {record} {records} {device} {artifact} - they are filled in after merging.
//
// Defaults deliberately make NO factual claims (no numbers, no benchmarks, no testimonials). Sections that would need facts
// (proof, features, compat) are off until the config supplies them.

export const DEFAULTS = {
  brand: {
    name: 'Acme',
    tagline: 'Everything in one place.',
    description: '{brand} - everything in one place.',
    lang: 'en',
    logo: { style: 'hex', letter: '' },
    colors: { primary: '#1e5bd8', signal: '#1fb8e0' },
    font: { body: 'Inter', display: 'Bricolage Grotesque', mono: 'JetBrains Mono' },
    footerNote: 'Internal use only.',
  },
  // design.theme: 'studio' (flat, warm, display headlines - the default) or 'classic' (the original pale surface with soft brand-tinted shadows)
  design: { theme: 'studio' },
  vocab: { device: 'phone', artifact: 'app', record: 'record', records: 'records', area: 'Publishing' },
  nav: { dashboard: 'Dashboard', connect: 'Connect a {device}', publishing: 'Publishing', team: 'Team', home: 'Home page', suffix: 'dashboard' },
  landing: {
    kicker: null,
    navLabels: { proof: 'Why {brand}', releases: "What's new", help: 'Help' },
    faqTitle: 'Questions people ask', faqLead: 'Something else? Just ask.',
    badge: { tag: 'New', text: null },
    headline: 'Everything {brand} does, {accent}.',
    accent: 'in one place',
    sub: '{brand} keeps your work in one place, and sends the result where it belongs.',
    primaryAction: { label: 'Get started', href: '/login' },
    downloadLabel: 'Download for {device}',
    howToInstall: [
      'Tap Download on the {device}, or scan the code from a computer.',
      'Open the file. Your {device} may ask you to allow installs from your browser - allow it once.',
      'Tap Install, then open {brand}.',
    ],
    story: {
      kicker: 'How it works', title: 'From first tap to finished.', lead: 'Four steps. Follow the line.',
      steps: [
        { time: 'Step 1', title: 'Open {brand}', text: 'Sign in once and your work is ready.', tags: ['Quick start'],
          screen: { kind: 'list', title: 'Start', sub: 'Today', cards: [{ title: 'New {record}', sub: 'Ready', pill: 'Open', tone: 'dark' }, { title: 'Recent', sub: 'Last 7 days', pill: 'View' }], cta: 'Start' } },
        { time: 'Step 2', title: 'Do the work', text: 'A guide on screen shows what is left to do.', tags: ['Guided'],
          screen: { kind: 'grid', title: 'Working', sub: 'In progress', guide: 'Keep going', bar: 46 } },
        { time: 'Step 3', title: 'Check the result', text: 'See the result straight away and fix anything that looks wrong.', tags: ['Instant result'],
          screen: { kind: 'result', title: 'Result', sub: 'Done', big: { label: 'Total', value: '12' }, cards: [{ title: 'Item A', sub: 'x 5', pill: 'OK', tone: 'green' }, { title: 'Item B', sub: 'x 4', pill: 'OK', tone: 'green' }] } },
        { time: 'Step 4', title: 'It sends itself', text: 'Finished work goes to your dashboard in the background.', tags: ['Automatic'],
          screen: { kind: 'progress', title: 'Sending', sub: 'You can close the app', cards: [{ title: 'Your {record}', sub: '12 items', pill: '78%' }], bar: 78 } },
      ],
      end: 'Sent. Everything is on the dashboard.',
    },
    proof: null,
    features: null,
    compat: null,
    cta: { title: 'Ready to start?', text: 'Get {brand} and finish your first {record} today.' },
    faq: [],
    releasesTitle: 'Every version, newest first',
  },
  signin: { eyebrow: '{brand} dashboard', title: 'Welcome back.', text: 'Enter the shared password to continue.' },
  mfa: { eyebrow: '{brand} · {area}' },
  publishing: {
    artifact: 'app', extensions: ['.apk'], parseApk: false, packageName: '', testers: true,
    title: 'Publishing', sub: 'Drop a file and every {device} is offered it.',
    kinds: ['new', 'improved', 'fixed'],
  },
  dashboard: {
    eyebrow: 'Live from the field', title: 'Your {records}, one by one.',
    sub: 'Open a {record} to see what was captured. Filter by status, search by name, or pick a facet.',
    empty: 'No {records} yet. Once a {device} or script sends one, it appears here.',
    statuses: [
      { id: 'new', label: 'New', tone: 'accent' },
      { id: 'reviewed', label: 'Reviewed', tone: 'ok' },
      { id: 'attention', label: 'Needs attention', tone: 'unsure' },
    ],
    labels: { title: 'Name', subtitle: 'Place', category: 'Type', owner: 'Owner', source: 'Source' },
    facets: ['category', 'owner', 'source', 'status'],
    metrics: [],
    stats: [
      { label: '{records}', kind: 'count' },
      { label: 'need attention', kind: 'status', status: 'attention', tone: 'unsure' },
    ],
    itemsLabel: 'Items', filesLabel: 'Photos',
    search: 'Search name, place or owner',
  },
  connect: {
    title: 'Connect a {device}', sub: 'Point another {device} at this site with one link.',
    where: 'Settings → Dashboard', curl: true,
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

/** Fills {brand} {record} ... in every string. Unknown {words} are left alone (they may be literal). */
export function interpolate(value, vars) {
  if (typeof value === 'string') return value.replace(/\{(brand|record|records|device|artifact|area)\}/g, (m, k) => (vars[k] ?? m));
  if (Array.isArray(value)) return value.map((v) => interpolate(v, vars));
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, vars)]));
  return value;
}

// Runs before every build: the public homepage must keep up with the app.
// Fails when a tab exists without homepage coverage, or when a language's
// homepage / tutorial falls out of step with English.
import { CONTENT, FEATURE_IDS, TAB_COVERAGE } from '../src/public/content.js';
import { TAB_ACCESS } from '../src/auth/roles.js';

const problems = [];
const tabs = new Set(Object.values(TAB_ACCESS).flat());
const en = CONTENT.en;

for (const tab of tabs) {
  const cov = TAB_COVERAGE[tab];
  if (!cov) { problems.push(`tab "${tab}" has no homepage coverage — add a feature (FEATURE_IDS) or tutorial step and map it in TAB_COVERAGE`); continue; }
  const [kind, ref] = cov.split(':');
  if (kind === 'feature' && !FEATURE_IDS.includes(ref)) problems.push(`tab "${tab}" points to unknown feature "${ref}"`);
  if (kind === 'tour' && !en.tour.steps[Number(ref)]) problems.push(`tab "${tab}" points to missing tutorial step ${ref}`);
}
if (en.features.items.length !== FEATURE_IDS.length) {
  problems.push(`FEATURE_IDS has ${FEATURE_IDS.length} ids but the English homepage lists ${en.features.items.length} features`);
}

// every language mirrors the English structure
const shape = (v) => (Array.isArray(v) ? v.map(shape) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, shape(v[k])])) : typeof v);
const want = JSON.stringify(shape(en));
for (const [lang, c] of Object.entries(CONTENT)) {
  if (lang !== 'en' && JSON.stringify(shape(c)) !== want) {
    problems.push(`homepage/tutorial in "${lang}" does not match English (missing or extra sections, features, steps or tips)`);
  }
}

if (problems.length) {
  console.error('\nHomepage check failed — the public page is out of date:\n  - ' + problems.join('\n  - ') + '\n');
  process.exit(1);
}
console.log(`Homepage check: ${tabs.size} tabs covered, ${Object.keys(CONTENT).length} languages in step.`);

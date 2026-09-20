# PROJECT_STATUS.md — Reichstag Political Strategy Game

## Current phase
**Phase 1, Step 5 — Extract `sim-script`, `flow-block` and `engine-script` into
external `.js` files (complete).**
Builds on Steps 1–4 (same session). The last three inline code blocks now load
from `sim-script.js`, `flow-block.js` and `engine-script.js` via plain
`<script src>` tags (so `file://` works), which makes `elections.html` a thin
shell over external files. Gameplay behavior is unchanged; the only logic edits
are to the export path (`buildFullDocument()` and the `ext-source-cache`
loader) so a published copy can still recover these blocks' source text.

## Project reality check (superseding earlier assumptions in this doc's first draft)
This is not a from-scratch monolith. It's **three separate, previously-published
Claude Artifacts** that were being developed in parallel and are in the process of
being merged/split:

- **`economics.html`** — "Volkswirtschaftlicher Lagebericht": the static Ministry-
  of-Finance letterhead report (pages 1–3). Pure narrative/images, no `<script>`
  tags at all.
- **`metrics.html`** — "Kennzahlen-Register — Reichswirtschaftsministerium": the
  quarterly economic ledger/control-center as its **own standalone artifact**
  (same `engine-script`/`engine-style` logic that also lives inside `elections.html`
  page 4).
- **`elections.html`** — the combined document: pages 1–3 (content matching
  `economics.html`), page 4 (`#app`, built at runtime from the same engine-script
  logic that also lives in `metrics.html`), and page 5 (the Prussian election
  simulator: map, polling graphs, voter-flow model).

`elections.html` is the one actively being worked on in this thread. **It is a
live Claude Artifact**: `engine-script`'s `persist()` function calls
`window.claude.use('artifact').then(art => art.publish(buildFullDocument(state)))`
on every state change (debounced 500ms), and `buildFullDocument()` reconstructs
the *entire* document as a string by reading each major block's content back out
via `document.getElementById(id).textContent`. This is the mechanism this phase
had to work around, not just the "big file is hard to read" problem.

**Resolved:** `economics.html` and `metrics.html` are inert/legacy — their metrics
don't move and `economics.html` is presentational only. `elections.html` is the
sole live, actively-updating version of both the economy engine and the report
pages. They do not need to be reconciled or kept in sync; they can be treated as
historical reference only (or ignored) for all future phases unless that changes.

## What changed this phase
File: `elections data/elections.html` (4,365,123 → 1,409,579 bytes).

1. **Extracted three GeoJSON blobs to external files** (all three were verified
   byte-for-byte identical to what was inline before touching anything):
   - `wahlkreise-data-script` (`const DATA = {...}`) → `wahlkreise-data.js`
   - `shadow-data-script` (`const SHADOW_DATA = {...}`) → `shadow-data.js`
   - `state-borders-data-script` (`const STATE_SHADOWS = [...]`) → `state-borders-data.js`

   Each is now `<script id="..." src="....js"></script>`. **No other code changed
   as a result of this** — classic (non-module, non-async, non-defer) external
   `<script>` tags still execute synchronously, in document order, before
   `sim-script` runs, and the `DATA` / `SHADOW_DATA` / `STATE_SHADOWS` top-level
   `const`s they define are still visible to every later inline `<script>` on the
   page (all non-module script elements in one document share the same top-level
   script scope — this is why nothing downstream needed to change).

2. **Added `ext-source-cache`** — a new small loader `<script>`, inserted right
   before the Turf.js CDN tag. On page load it `fetch()`es the raw text of the
   three files above (in parallel, non-blocking) and caches it in
   `window.__extSourceCache[id]`. `window.__extSourceReady` is the `Promise.all(...)`
   for all three fetches. This cache is used for exactly one thing: giving
   `buildFullDocument()` back the original source text it used to get from
   `.textContent`, since an externally-sourced `<script src>` element has none.

3. **`buildFullDocument()` is now async** — returns `Promise<string>` instead of
   `string`. It awaits `window.__extSourceReady`, then reads the three blocks via
   a small `sourceOf(id)` helper (cache first, falls back to live `.textContent`
   if an id somehow isn't cached — e.g. if a block gets re-inlined later). Every
   other line of `buildFullDocument()` is untouched: `engine-style`,
   `engine-script`, `prussia-csv-raw`, `sim-script`, page 1–3 HTML, and the final
   assembled document string are all read/built exactly as before.

4. **`persist()`'s one call site** updated to chain `.then()` on the now-async
   `buildFullDocument(state)` before calling `art.publish(...)`. Same error
   handling (`conflict` → `location.reload()`), same debounce, same
   `localStorage` write — only the artifact-publish path changed shape.

### Verification performed
- Confirmed `wahlkreise-data.js` / `shadow-data.js` / `state-borders-data.js` /
  `data.csv` were byte-identical to the corresponding inline blocks *before*
  any edit (Python string-equality check, not just diffing).
- `node --check` passed on every real inline `<script>` block after editing:
  the loader, `sim-script`, `flow-block`, and `engine-script`.
- Diffed old vs. new `elections.html`: the common prefix (everything before the
  Turf CDN tag — all images, pages 1–3, CSS, `state-data`, `prussia-csv-raw`) and
  common suffix (everything after the `buildFullDocument`/`persist` edits) are
  byte-identical to the original. Only the intended middle section changed.
- Caught and fixed a self-inflicted bug during this phase: the first draft of the
  `ext-source-cache` loader's comment literally contained the closing-script-tag
  text (while explaining what used to be inline), which — being inside a real
  script element — the HTML parser reads as the actual closing tag, truncating
  the script early. Rewritten to avoid that literal sequence anywhere in
  in-script comments. Documented here as a reminder: **never place a literal
  closing-script-tag sequence inside any script element's text, including
  comments**, in this file.

### What did NOT change
- `sim-script`'s CSV logic itself (the parse rules, `parseCSV()`, `demo()`) —
  only *when* and *from where* it reads the raw text changed, not what it does
  with it.
- `flow-block`'s and `engine-script`'s own logic — unchanged (their existing
  defensive `pruState` guards, noted above, already predate this phase).
- `economics.html`, `metrics.html` — untouched, not analyzed beyond identifying
  what they are.
- `flow_block.js` — **deliberately not wired in or merged.** See "Known
  divergence: flow_block.js" below.
- The `wahlkreise.geojson` / `prussia.geojson` / `other_german_states.geojson`
  files under `data/` — not used by this wiring. `other_german_states.geojson`
  is byte-identical to `shadow-data.js`'s payload (just saved without the
  `const SHADOW_DATA=` wrapper). `wahlkreise.geojson` and `prussia.geojson` are
  each a single `Feature` (not a `FeatureCollection` of many), consistent with
  being precomputed outline unions (the kind `computeStateOutline()` in
  `sim-script` produces via `turf.union`) rather than raw constituency data —
  worth confirming their intended use before folding them into anything.

## Phase 1, Step 2 — what changed (CSV extraction)
File: `elections data/elections.html` (1,409,579 → 1,388,706 bytes).

1. **Removed the inline `prussia-csv-raw` block entirely.** Unlike the three
   GeoJSON blocks, it does not get a `<script src="data.csv">` tag — a
   `<script>` with a non-JavaScript `type` attribute never fetches its `src`
   at all (the HTML spec aborts "prepare the script" before that point for an
   unrecognized type), so that tag would have been dead weight. Its raw text
   is now served purely by the `ext-source-cache` fetch.
2. **`ext-source-cache`'s `EXT_FILES` map now includes
   `'prussia-csv-raw': 'data.csv'`**, fetched in parallel with the other three,
   same cache, same `window.__extSourceReady` promise. Comment updated to
   explain why this one has no matching `<script src>`.
3. **`sim-script`'s CSV consumption is now async.** It used to read
   `document.getElementById("prussia-csv-raw").textContent` synchronously at
   parse time. It now wraps the same try/catch/fallback logic (`parseCSV(...)`
   → `demo()` on failure) in `(window.__extSourceReady || Promise.resolve()).then(...)`,
   reading `window.__extSourceCache["prussia-csv-raw"]` instead. The two
   `renderPartyControls()`/`renderMapModeSelect()` calls that followed moved
   inside the same `.then()` (unchanged logic, just deferred alongside the
   data they depend on). The `mapMode` change-listener attachment was left
   outside the `.then()` (unchanged position) since it doesn't touch
   CSV-derived data.
4. **`buildFullDocument()`'s `csvRawText`** now comes from the existing generic
   `sourceOf('prussia-csv-raw')` helper (added in Step 1) instead of a direct
   `.textContent` read — same helper the three GeoJSON blocks already use, no
   new mechanism introduced.

### A residual timing note (not a bug, but worth recording honestly)
`engine-script` (page 4) already has defensive guards before touching
`window.pruState`/`window.pruNationalForSwings` (a `simReady` check and
several `typeof window.pruState === 'undefined'` guards) — these predate this
phase and weren't added by it. Because of them, if `engine-script` happened to
run before the CSV `.then()` callback fires, it would find `pruState`
temporarily absent/default rather than crash. In practice this is very unlikely
to matter: browsers flush the microtask queue between top-level `<script>`
executions, the CSV fetch (22 KB) starts before the three much larger GeoJSON
`<script src>` loads even begin, and it is essentially always resolved by the
time `sim-script` reaches that line. This is a theoretical race, not an
observed or expected one — flagged here rather than "fixed" further, since
closing it completely would mean adding readiness-awaiting to `engine-script`
itself, which is out of this phase's scope (touching the economy/metrics
system beyond the one call site described above).

### Verification performed (Step 2)
- Confirmed `data.csv` was still byte-identical to the inline block immediately
  before removing it.
- `node --check` passed on the loader, `sim-script`, `flow-block`, and
  `engine-script` after editing.
- Line-based diff (`difflib`) against the Step 1 output found exactly 5 changed
  hunks, all matching the 4 intended edits above (one hunk split in two by the
  differ) — nothing else in the file moved.
- Confirmed zero remaining `getElementById('prussia-csv-raw')` references, and
  that all remaining textual occurrences of `prussia-csv-raw` are the expected
  ones (comments, the `EXT_FILES` key, the cache lookup, `sourceOf(...)` call,
  and the reconstructed inline block string inside `buildFullDocument()`).
- Re-checked the loader block for the same "literal closing-script-tag text
  inside a comment" hazard caught in Step 1 — clean this time.

## Phase 1, Step 4 — Regression: CSV silently failing to load, and the fix

### The bug (introduced by Step 2, reported by the user after testing locally)
Step 2 moved `prussia-csv-raw`'s loading onto `ext-source-cache`'s `fetch()`
mechanism (the same cache the GeoJSON blocks use for `buildFullDocument()`
reconstruction). That was the mistake: **`fetch()` of a local sibling file is
blocked by browser security rules when the page is opened directly from disk**
(a `file://` URL) rather than served over `http(s)`. The three GeoJSON files
never had this problem because they load via `<script src>`, which is a normal
resource load (like an `<img src>`), not subject to the same restriction
`fetch()`/`XMLHttpRequest` are under `file://`. The failure was silent: the
`fetch()` rejects, is caught by `ext-source-cache`'s own `.catch()` (which only
`console.error`s), so `window.__extSourceCache['prussia-csv-raw']` never gets
set, `sim-script`'s CSV block sees `__csvText == null`, and — by design of the
*original, pre-extraction* fallback logic — quietly calls `demo()` instead of
throwing a visible error. Net effect: **the constituency map silently showed
illustrative placeholder data instead of the real dataset**, with nothing in
the UI indicating anything was wrong.

This did not affect the three GeoJSON files or the map/graphs' basic
rendering (those all still work fine offline) — only the per-constituency
demographic/baseline data that `prussia-csv-raw`/`data.csv` supplies.

### The fix
Stopped using `fetch()` for the CSV entirely. Added **`prussia-csv-raw.js`**,
a new file containing `const PRUSSIA_CSV_RAW = "...";` (the CSV text as a JS
string, safely escaped via `JSON.stringify`) — loaded via a plain
`<script id="prussia-csv-raw-script" src="prussia-csv-raw.js"></script>` tag,
inserted right after `state-borders-data-script` and before `sim-script`,
exactly mirroring how `DATA`/`SHADOW_DATA`/`STATE_SHADOWS` already load. This
means:
- `sim-script`'s CSV consumption **reverted to fully synchronous** (no more
  `.then()`/`window.__extSourceReady` wait) — it now reads the `PRUSSIA_CSV_RAW`
  global directly, same try/catch/fallback-to-`demo()` logic as originally.
  This also removes the "residual timing note" theoretical race flagged in
  Step 2 — there's no longer any async boundary here to race.
- `ext-source-cache`'s `EXT_FILES` map no longer includes `prussia-csv-raw` —
  it never needed `fetch()`-based caching in the first place; only the CSV's
  *export/reconstruction* use in `buildFullDocument()` needed a way to recover
  the text, and that's now solved by reading the `PRUSSIA_CSV_RAW` global
  directly (same trick as `DATA` etc. — classic scripts share top-level scope),
  not via the cache/`sourceOf()` helper.
- `buildFullDocument()`'s `csvRawText` now reads
  `(typeof PRUSSIA_CSV_RAW !== 'undefined') ? PRUSSIA_CSV_RAW : ''` directly.
  It still reconstructs the exported document's CSV as an inline
  `<script id="prussia-csv-raw" type="text/plain">` block (unchanged), matching
  how the GeoJSON blocks also get inlined back in the export — the split
  files are purely a local-development convenience; the published artifact is
  still one self-contained file.

**Why the GeoJSON `ext-source-cache`/`fetch()` mechanism wasn't also changed:**
`buildFullDocument()` is only ever invoked from `persist()`'s
`window.claude.use('artifact')` branch — a check that's `false`/skipped
whenever `elections.html` is opened as a plain local file (`window.claude`
doesn't exist there), which is exactly the scenario where `fetch()` under
`file://` fails. So that fetch-based path is never actually exercised during
local testing either way, and works normally in the real artifact-hosting
context (served over a proper origin, where `fetch()` isn't restricted). The
CSV was different specifically because `sim-script`'s core rendering (which
**does** run in every context, local file included) depended on it — that's
what made this bug visible and the GeoJSON path's use of fetch not (yet)
visibly broken. Worth remembering if any *other* future extraction is tempted
to route gameplay-critical (not just export-critical) data through
`ext-source-cache`'s fetch: don't — use a `<script src>`-loaded JS constant
instead, per this fix.

### A data-format note (unrelated to the bug, found while fixing it)
`data.csv` (the sibling file already present in `elections data/` before this
session) uses CRLF line endings; the CSV that was actually inline in the
original `elections.html` uses LF only. Not a bug — CSV parsers handle both —
but `prussia-csv-raw.js` was built directly from the **original inline LF
content** (verified byte-identical to it), not from `data.csv`, to avoid
introducing an unrelated line-ending change. `data.csv` is no longer read by
`elections.html` at all as of this fix (superseded by `prussia-csv-raw.js`) —
kept in the folder as a plain-CSV reference copy only.

### Verification performed (Step 4)
- Confirmed the CSV text contains no literal `</script` sequence before
  embedding it in a script element.
- Round-tripped `prussia-csv-raw.js` (parsed its JS string literal back out)
  and confirmed it's byte-identical to the **original** inline CSV content
  from the very first uploaded `elections.html` — not just to `data.csv`
  (which, per the note above, differs only in line-ending style).
- `node --check` passed on the loader, `sim-script`, and `engine-script` after
  editing.
- Line-based diff against the Step 3 output: exactly 5 changed hunks, all
  matching the edits described above — nothing else in the file moved.
- Simulated loading `prussia-csv-raw.js` in Node and confirmed
  `PRUSSIA_CSV_RAW` is a 21,917-character string with the expected CSV header
  and all 265 data rows (266 total lines) intact.


## Phase 1, Step 5 — what changed (code extraction)
Files: `elections data/elections.html` (1,389,445 → 1,229,616 bytes); **new**
`sim-script.js` (47,112 chars), `flow-block.js` (19,365), `engine-script.js`
(93,959), all UTF-8, LF, no BOM, placed next to `elections.html`.

1. **Replaced the three inline blocks with external tags**, keeping their ids and
   their exact position/order: `<script id="sim-script" src="sim-script.js">`,
   `<script id="flow-block" src="flow-block.js">`,
   `<script id="engine-script" src="engine-script.js">`. Load order is still Turf →
   the four data files → `sim-script` → `flow-block` → `engine-script`, so nothing
   downstream sees a different top-level scope or a different DOM state at run time.
2. **File contents.** `sim-script.js` and `flow-block.js` are byte-identical to
   the old inline text. `engine-script.js` is identical except for the
   `buildFullDocument()` edits in item 4 (2 changed code lines, 2 rewritten comments).
3. **`ext-source-cache`'s `EXT_FILES` now also lists** `sim-script`, `flow-block`
   and `engine-script` (plus a short comment paragraph). Still export-only: the game
   itself never waits on it, and per Step 4's lesson every gameplay-critical file is
   a plain `<script src>`.
4. **`buildFullDocument()`** now reads `engineText` and `simText` through
   `sourceOf(...)` (`flowText` already did). This edit was *required*, not cosmetic:
   an external script element has no `.textContent`, so the old direct reads would
   have emitted empty `sim-script`/`engine-script` blocks into every published copy.
   Inline blocks (as in the exported single-file document) still work via
   `sourceOf()`'s `.textContent` fallback.
5. **Not touched:** `flow_block.js` (legacy 1921→1924 fork — note the underscore;
   the new file is `flow-block.js` with a hyphen, so the two names are easy to mix
   up), the four data files, `economics.html`, `metrics.html`, `data/*.geojson`.

### Verification performed (Step 5)
- `sim-script.js` / `flow-block.js` byte-equal to the original inline blocks;
  `engine-script.js` diff vs. the original inline block = exactly the intended hunks.
- `elections.html` diff vs. the input: 3 hunks (loader comment, `EXT_FILES`, and the
  three blocks collapsing to three tags). Nothing else moved.
- `node --check` clean on all three new files; every remaining inline JS block
  compiles; none of the three files contains a closing-script-tag sequence or an
  HTML comment opener (matters because `engine-script`'s text is re-inlined
  unescaped by `buildFullDocument()`).
- **Behavioral differential test in real Chromium over `file://`**, original vs.
  new, `Math.random`/`Date.now` fixed: load, page-4 edits + undo, page-5 flow input,
  all map modes, all government toggles, map clicks, reload (state restored from
  `localStorage`), and reset. At all six checkpoints the DOM (script elements
  stripped), `localStorage` and `pruState` were identical; no page errors; all seven
  local `.js` files return 200 with no failed requests. (Every checkpoint also
  differed from the previous one, so the interactions did exercise the code.)
- **Export test over `http://`** (where `fetch()` works) with a fake
  `window.claude` capturing `art.publish(doc)`: the published document from the new
  build is identical to the original's except for the intended `engine-script`
  edits; each `sim-script`/`flow-block`/`engine-script` block in it equals its source
  file. The exported single-file document also loads standalone and behaves the same
  as the export from the original.

### Limits of that verification (be aware)
- The four data files (`wahlkreise-data.js`, `shadow-data.js`,
  `state-borders-data.js`, `prussia-csv-raw.js`) were **not in the uploaded
  material**, so the browser tests ran on synthetic stand-ins (30 square
  constituencies, generated CSV). That proves the extraction is behavior-neutral; it
  does not exercise the real map or the real 265-row dataset. A quick manual open of
  `elections.html` from disk with the real folder is still worth doing.
- The export test used a fake `window.claude`, not the real artifact host.

### New observations (found during Step 5; deliberately NOT fixed — out of scope)
- **Exported/published single-file copy falls back to demo data.** Reproduced in
  both the original and the new build, so it predates Step 5: since Step 4,
  `sim-script` reads the global `PRUSSIA_CSV_RAW`, but `buildFullDocument()` still
  emits the CSV as `<script id="prussia-csv-raw" type="text/plain">`, which defines no
  such global. The exported copy logs "Falling back to illustrative demo data:
  embedded CSV not found". Likely fix: emit the export as
  `const PRUSSIA_CSV_RAW = <JSON string>;` instead.
- Under `file://` the loader's `fetch()` calls all fail (already true for the data
  files), so the console now shows six "Fetch API cannot load…" errors instead of
  three. Harmless — the export path is never used there — but noisy. Optional tidy:
  skip the fetches when `location.protocol === 'file:'`.
- Publishing from a build where those fetches fail *and* `window.claude` exists
  would now drop `sim-script`/`engine-script` too, not just the data blocks. Not
  reachable in the current workflow (local `file://` has no `window.claude`).

## Known divergence: flow_block.js

`flow_block.js` (in `elections data/`) is **not** identical to the inline
`flow-block` script in `elections.html`. It's a hand-duplicated copy relabeled
for an earlier 1921→1924 election cycle (year strings swapped throughout: German
UI labels, code comments, chart titles), plus two extra input fields
(`firstTimers`, `departures`) not present in the 1924→1927 version currently
wired into `elections.html`. Diffed in full; no logic beyond the labels/inputs
differs.

This looks like an early, manual attempt at supporting more than one election
cycle by copy-pasting the block per cycle rather than parameterizing it — which
is exactly the anti-pattern the eventual multi-term design needs to avoid (see
roadmap Phase 2, "generalize the election engine to run repeatably"). Per
instruction, it is being treated as **existing legacy functionality**, left
untouched and *not* wired into `elections.html` or merged with the live
`flow-block`. Both versions currently coexist as separate files. Generalizing
the voter-flow model into a single parameterized (year-agnostic) function is
explicitly a later-phase decision, not something to resolve incidentally here.

## Known bug (pre-existing before this session, fixed in Phase 1 Step 3)
`buildFullDocument()` never read `flow-block`'s content and never emitted it in
the reconstructed document, so republishing the artifact silently dropped the
voter-flow feature from the exported copy. **Fixed** — see "Phase 1, Step 3"
below. Left documented here as history rather than deleted, since it's useful
context for why the fix exists.

## Phase 1, Step 3 — what changed (flow-block reconstruction fix)
File: `elections data/elections.html` (1,388,706 → 1,389,381 bytes).

1. **`buildFullDocument()` now reads `flow-block` too.** Added
   `var flowText = sourceOf('flow-block');` right after the existing `simText`
   line. `flow-block` is still inline in the live document (not extracted to
   an external file, per that step's instructions — extracted later in Step 5), so `sourceOf()` — the same
   generic helper the three GeoJSON blocks and the CSV block already use —
   simply falls through to its `.textContent` branch. Using the shared helper
   here (rather than a bare `document.getElementById(...).textContent` read,
   which is what every other still-inline block uses) is deliberate: if
   `flow-block` is ever extracted to an external file in some later phase,
   `buildFullDocument()` won't need to change again — this is the
   "one consistent way to fetch the original source of block X" pattern the
   `ext-source-cache` architectural decision already called for.
2. **Added `flowHtml`**, built exactly the same way as `simHtml`
   (`'<script id="flow-block">' + flowText.replace(/<\/script/gi, '<\/script') + '<' + '/script>'`),
   right after the existing `simHtml` line.
3. **Inserted `flowHtml` into the assembled document string**, between
   `simHtml` and `engineHtml` — matching `flow-block`'s actual position in the
   live document (`sim-script` → `flow-block` → `engine-script`), confirmed
   against the live script-tag order before making this change.

### What did NOT change
- `flow-block`'s own content — confirmed byte-identical to the very first
  uploaded version of `elections.html`, unchanged across all three phases this
  session.
- `flow_block.js` (the 1921→1924 legacy fork) — not touched, not merged, not
  referenced by this fix. `buildFullDocument()` reconstructs the live
  1924→1927 `flow-block` only, same as the running page always has.
- No runtime/interactive election behavior — this fix only touches
  `buildFullDocument()`, which is called from exactly one place
  (`persist()`'s artifact-publish path). It has no effect on anything the
  player sees or does during normal use of pages 1–5; it only changes what a
  *republished/exported copy* of the document contains.

### Verification performed (Step 3)
- `node --check` passed on `engine-script` after editing.
- Line-based diff against the Step 2 output: exactly 3 changed hunks (2
  insertions + 1 replace), all matching the 3 intended edits above — nothing
  else in the file moved.
- Confirmed the live `flow-block` block's content is byte-identical to the
  original first-uploaded `elections.html` (never modified, this session or
  otherwise).
- Simulated the exact `.replace(/<\/script/gi, ...)` escaping logic
  `buildFullDocument()` uses on the real `flow-block` content: confirmed the
  escaped output contains no unescaped `</script` sequence and the wrapper
  tag is well-formed, so the reconstructed document's `flow-block` element
  would parse back to the identical content.
- No election/voter-flow runtime behavior was touched (only the export
  function), so there is nothing new to test interactively — confirmed by
  inspection that `flow-block`'s own script content, and everything that
  calls into it (`renderFlow`, `pruState.flow`, etc.), is untouched.

## Architectural decisions made this phase
- **External-source-cache pattern** (`ext-source-cache` → `window.__extSourceCache`
  / `window.__extSourceReady`) is now the established mechanism for "this block
  used to be inline and `buildFullDocument()` needs its raw text back." Any
  future extraction should reuse this same cache/registry rather than inventing
  a parallel mechanism (as of Step 5 it covers the three GeoJSON files plus
  `sim-script`, `flow-block` and `engine-script`; the CSV left it in Step 4), so `buildFullDocument()` has one consistent way to fetch
  "the original source of block X" regardless of how many blocks end up
  extracted.
- Data loading for gameplay-critical globals (`DATA`, `SHADOW_DATA`,
  `STATE_SHADOWS`) stays **synchronous** via classic external `<script src>`
  tags — deliberately not converted to `fetch`-based async loading, to avoid
  touching `sim-script`'s existing (synchronous) assumptions about when these
  globals become available. Only the *export/reconstruction* path (which was
  already async-friendly, being inside promise chains) was made async.

## Completed work (cumulative)
- Phase 0: full read-through and architecture mapping of `elections.html` as it
  existed before any files were split (superseded by the "project reality check"
  above once `economics.html`/`metrics.html` were seen).
- Phase 1, Step 1: GeoJSON extraction + artifact-publish-safe reconstruction
  mechanism (`ext-source-cache`).
- Phase 1, Step 2: CSV extraction, reusing the same mechanism.
- Phase 1, Step 3: fixed the `flow-block`-omitted-from-`buildFullDocument` bug,
  reusing the same `sourceOf()` helper.
- Phase 1, Step 4: fixed a regression from Step 2 — CSV data silently failing
  to load under `file://` — by switching from `fetch()` to a `<script
  src>`-loaded JS constant (`prussia-csv-raw.js`).
- Phase 1, Step 5: extracted `sim-script`, `flow-block` and `engine-script` into
  `sim-script.js`, `flow-block.js` and `engine-script.js` (plain `<script src>`,
  `file://`-safe); `buildFullDocument()` recovers their source via `sourceOf()`.

## Current task
None in progress. This document is the deliverable for the end of Phase 1,
Step 5.

## Next task
Pending explicit direction. The only remaining Phase 1 candidate:
1. Decide what to do about `flow_block.js` (the 1921→1924 legacy fork) — keep
   coexisting indefinitely, or start the parameterization work now instead of
   in a later phase. (Left untouched in Step 5, as instructed.)

Already done: extracting `sim-script`, `flow-block` and `engine-script` (Step 5) —
`elections.html` is now the thin shell over external files sketched in the Phase 0
target layout. Also worth deciding before/alongside Phase 2: whether to fix the
exported-copy CSV problem listed under Known bugs.

Once Phase 1 is declared finished: Phase 2+ from the original roadmap (economy/
ministry decisions, campaign phase, etc.) — explicitly deferred until then, per
this session's instruction to finish Phase 1 before starting new gameplay
systems.

## Known bugs
- **Open (pre-existing since Step 4, found in Step 5):** an exported/published
  single-file copy of `elections.html` loads demo data instead of the real CSV
  (`buildFullDocument()` emits a text/plain CSV block but `sim-script` reads the
  `PRUSSIA_CSV_RAW` global). Details and likely fix under Step 5 "New
  observations". Does not affect the split/local build.
- `buildFullDocument()` omitting `flow-block` (pre-existing before this
  session) — fixed in Phase 1, Step 3.
- CSV data silently falling back to placeholder demo data when
  `elections.html` is opened as a local file (introduced by this session's own
  Step 2, not pre-existing) — fixed in Phase 1, Step 4. Correcting an earlier
  version of this document, which claimed "none introduced by this phase" for
  Steps 1–2 based on structural diffing alone; that verification confirmed the
  *edits were scoped correctly*, but did not catch that one of those edits
  (routing gameplay-critical CSV loading through `fetch()`) was behaviorally
  wrong in the `file://` context until the user tested it. Noted here as a
  reminder that diff-scoping verification and actual-behavior verification are
  different things — this session leaned on the former more than the latter.

## Important architectural decisions (carried over from Phase 0)
- Keep the accountability/polling engine (`partySwingPoints`,
  `getAccountabilityBaselines`, `approvalRating`) and the voter-flow model —
  don't rewrite them from scratch; they already do real work the target design
  needs.
- Do not extend the artifact-self-publishing pattern to new subsystems without
  reusing `ext-source-cache`; do not invent a second reconstruction mechanism.
- New player-facing systems (campaign actions, coalition negotiation, bills)
  should call into the existing economy/polling engines rather than duplicating
  metric logic — unchanged from Phase 0.

## Files changed this session
- `elections data/elections.html` — modified in five steps (GeoJSON
  extraction, CSV extraction, `flow-block` reconstruction fix, CSV-loading
  regression fix, code-block extraction — see each "what changed" section above).
- `elections data/sim-script.js`, `flow-block.js`, `engine-script.js` — **new
  files**, added in Step 5. Now the actual source of the simulator, voter-flow and
  economy-engine code (hyphenated; not to be confused with legacy `flow_block.js`).
- `elections data/prussia-csv-raw.js` — **new file**, added in Step 4. Now the
  actual source of constituency CSV data for `elections.html`.
- `elections data/wahlkreise-data.js`, `shadow-data.js`, `state-borders-data.js`
  — unchanged content, referenced by `elections.html` since Step 1.
- `elections data/data.csv` — unchanged content, but **no longer read by
  `elections.html`** as of Step 4 (superseded by `prussia-csv-raw.js`); kept as
  a plain-CSV reference copy only. See the "data-format note" in Step 4.
- `elections data/flow_block.js` — unchanged, not wired in (see "Known
  divergence" above).
- `elections data/economics.html`, `metrics.html` — unchanged, not opened
  beyond confirming their purpose.
- `data/*.geojson` — unchanged, not used by this session's wiring.
- `docs/PROJECT_STATUS.md` — this file, updated.

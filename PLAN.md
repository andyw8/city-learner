# City Learner — Plan

An app to learn the geography of a city: major roads, neighbourhoods, rivers/lakes,
and famous buildings/attractions. Features are memorised with spaced repetition,
tested in two directions.

## Decisions

| Area | Choice |
| --- | --- |
| Platform | Static web app (no backend) |
| Stack | Vite + TypeScript + MapLibre GL JS + Dexie (IndexedDB) |
| Cities | Toronto and Glasgow; a city is a data parameter, switchable in the header |
| Deck source | OSM/Overpass generated + curated overrides |
| SRS | FSRS via `ts-fsrs`, tuned light (see below); progress tracked per city |
| Mode A answer | Free text by default (fuzzy matching); per-question multiple-choice toggle |
| Basemap | Hosted OpenFreeMap style, fetched at runtime with labels hidden until reveal |
| Tests | Vitest (unit) + Playwright (e2e) |

## The two modes

- **Mode A — Identify.** Highlight one feature on an unlabeled map; user types its
  name (free text, fuzzy-matched) or switches to four options for that question.
- **Mode B — Locate.** Given the name (and description), user clicks the map;
  scored by distance to the feature geometry.

Each `(feature, mode)` pair is an independent SRS card, so a feature is only
considered learned once it can be recognised *and* placed.

## Data model

```ts
type Category = 'road' | 'neighbourhood' | 'water' | 'landmark';

type Geometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] }
  | { type: 'Polygon'; coordinates: [number, number][][] };

interface Feature {
  id: string;                 // stable, e.g. "osm:way/123456"
  name: string;
  aliases: string[];
  category: Category;
  description: string;
  noun?: string;              // kind for prompts, e.g. "river", "secondary road"
  geometry: Geometry;
  osmId?: string;
  toleranceM?: number;        // Mode B scoring radius; defaults by category
}
```

Bounds (`bbox`) and centre are *derived* from geometry at load time rather than
stored, so authored and generated decks stay lean. Types are defined with Zod
and inferred from the schema.

```ts
interface Card {
  id: string;                 // `${featureId}:${mode}`
  city: string;               // owning city, so cities are tracked independently
  featureId: string;
  mode: 'identify' | 'locate';
  // FSRS state
  due: string;                // ISO timestamp
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;              // ts-fsrs State
  last_review?: string;
}
```

IndexedDB (Dexie) tables:

- `cards` — keyed by `id`; indexed by `due`, `featureId`, `mode`, `city`.
- `meta` — settings (daily new-card allowance, per-category tolerances, active city).

The deck itself is a static JSON file loaded read-only; only card state is persisted.

## Answer scoring

**Mode A (identify)**
- Free text by default, matched fuzzily against the name and aliases
  (normalisation, abbreviation expansion, generic-word stripping, edit distance).
- A per-question toggle switches to multiple choice; it resets to free text on the
  next question.
- Correct → `Good`.
- Incorrect → `Again`; show the correct name and description as feedback.
- Multiple-choice distractors: 3 other features from the same category,
  deterministic per card (seeded) so the UI is stable, then shuffled.

**Mode B (locate)**
- Distance from the click to the feature geometry:
  - `Point`: geodesic distance to the point.
  - `LineString`: minimum point-to-segment distance.
  - `Polygon`: 0 if inside, else distance to the boundary.
- Correct if within `toleranceM`; default tolerance by category
  (e.g. landmark ~150 m, neighbourhood ~600 m, road ~250 m, water ~400 m).
- Correct → `Good`; incorrect → `Again`. Optionally offer Hard/Easy buttons.

## Map

- MapLibre GL JS.
- Hosted [OpenFreeMap](https://openfreemap.org/) style fetched at load; every
  `symbol` layer is set to `visibility: none`, so nothing is labelled until
  reveal. A test asserts symbol layers are hidden by default.
- Highlight layer: a GeoJSON source plus `fill`/`line`/`circle` layers in a
  high-contrast colour, used to show the target in Mode A and feedback in both.
  It also renders `MultiLineString` road geometries.
- Attribution: OpenStreetMap (ODbL) and OpenFreeMap/OpenMapTiles must be shown.

## Deck generation

`npm run build:deck -- <city>` runs `scripts/build-deck.ts` (via `tsx`) and
writes `data/decks/<city>.json` from OpenStreetMap, guided by
`scripts/curate/<city>.yaml` (default `toronto`).

1. Queries the Overpass API (`overpass-api.de`, falling back to
   `overpass.kumi.systems`) once per category, scoped to the city's
   administrative area (e.g. City of Toronto relation 324211 → area 3600324211;
   Glasgow City relation 1906767 → area 3601906767) so neighbouring
   municipalities are excluded:
   - roads: named `motorway|trunk|primary|secondary` ways
   - neighbourhoods: `place=suburb|neighbourhood|quarter`
   - water: named `waterway=river|canal|stream` and `natural=water|bay`
   - landmarks: `tourism=*`, `leisure=stadium`, `man_made=tower`,
     `amenity=marketplace`, `historic=castle|monument|memorial`
2. Normalises geometry: node → Point, open way → LineString, closed way →
   Polygon, relation → stitched outer ring. Geometry is clipped to the bbox,
   simplified with Douglas–Peucker (25 m), and rounded to 6 decimal places.
3. Merges features that share a name. Roads fold directional suffixes
   ("Bloor Street West" → "Bloor Street") and stitch connected ways into runs,
   stored as a `MultiLineString` so a whole street is one feature; a per-category
   cap keeps the deck manageable.
4. Applies curation: `include` (force names in), `exclude` (drop), and `manual`
   entries that either patch a generated feature (description/aliases/tolerance)
   or add a standalone one (e.g. Lake Ontario, Union Station).
5. Emits a deck validated by the app's Zod schema. The output is committed so
   the app and tests run offline.

Overpass responses are cached in `scripts/.cache/` (gitignored, keyed by a hash
of the query), so reruns are offline and fast; pass `--refresh` to refetch.
Regenerate only when the deck should be updated — OSM changes over time.

## Repository layout

```
scripts/
  build-deck.ts             # Overpass -> data/decks/<city>.json
  lib/{overpass,normalise,geometry,curate}.ts
  curate/{toronto,glasgow}.yaml  # include/exclude/manual curation
  copy-maplibre-worker.mjs  # copy MapLibre worker assets into data/
data/
  decks/{toronto,glasgow}.json
src/
  main.ts app.ts window.d.ts style.css
  settings.ts
  deck/{types.ts,cities.ts,load.ts,geometry.ts,choices.ts,distance.ts,matching.ts,noun.ts,shuffle.ts}
  db/schema.ts
  srs/{types.ts,scheduler.ts,queue.ts,store.ts,stats.ts}
  map/{map.ts,style.ts,highlight.ts,labels.ts,view.ts}
  ui/{dom.ts,session.ts,identify.ts,locate.ts,settings.ts,dashboard.ts}
tests/
  unit/...
  e2e/...
```

## Milestones

1. **Scaffold** — Vite + TS, MapLibre, Dexie, Vitest, Playwright; empty app boots.
2. **Types + fixture deck** — data types, loader, a tiny hand-written Toronto
   fixture to unblock UI work.
3. **Map** — label-free basemap + highlight layer.
4. **Mode A** — multiple choice flow and scoring.
5. **Mode B** — click-to-locate and geometry distance scoring.
6. **SRS** — FSRS scheduling, session queue, persistence across reloads. ✅
7. **Real deck** — Overpass + curation script producing the Toronto deck. ✅
8. **Polish** — progress dashboard, per-category tolerances, settings, session summary. ✅
9. **Multi-city + modes** — city switcher and Glasgow deck, per-city progress,
   hosted basemap, free-text Identify answers, FSRS tuning, shuffled practice. ✅

## Non-goals (v1)
- No photos or media for landmarks.
- No user accounts or cross-device sync.
- No offline/PWA mode; the basemap is hosted and needs the network.

## Risks / open questions

- **OSM licensing.** ODbL attribution is required wherever OSM data appears.
- **Distractor quality.** Poor distractors make Mode A trivial; validate that
  choices share category and are a similar scale.
- **Feature ambiguity.** Several roads share names (e.g. "King Street"); aliases
  and stable OSM ids mitigate this.

## Implementation notes

- **Hosted basemap.** The local PMTiles cutout and its `ArchiveSource` workaround
  were dropped in favour of fetching OpenFreeMap's Bright style at runtime. This
  makes adding cities free (no per-city tile extraction) at the cost of a network
  dependency on first load.
- **MapLibre worker.** The production bundle does not emit MapLibre's worker or
  its shared chunk, so the map fails with "Worker failed to load". The `predev`
  and `prebuild` hooks run `scripts/copy-maplibre-worker.mjs` to copy
  `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into `data/`, and
  `map.ts` calls `setWorkerUrl('/maplibre-gl-worker.mjs')`.
- **Session start.** The session begins on `style.load`, not `load`, so the first
  question appears without waiting for every basemap tile to download.
- **Label reveal.** The fetched style keeps all symbol layers but sets
  `visibility: none`, so nothing is labelled while answering. On submit,
  `setLabelsVisible(map, true)` reveals the labels for feedback; the next question
  hides them again.
- **Sessions.** `runSession` drives a queue of `ReviewItem`s and delegates each to
  `presentIdentify` / `presentLocate`, which return a promise resolved on "Next".
  `Review` builds the queue from due and new cards (`buildQueue`) and writes FSRS
  state via Dexie; `Identify` / `Locate` are unscheduled practice over the whole
  deck. Cards are keyed `${featureId}:${mode}` and carry a `city`; `syncCards` and
  `loadCards` are scoped per city so one city's sync never touches another's.
- **Identify answer mode.** Free text by default, with a per-question toggle to
  multiple choice that resets on the next question (no persisted preference).
- **Practice order.** Identify/Locate shuffle the deck per session
  (`deck/shuffle.ts`); Review order still comes from the FSRS queue.
- **Scheduler tuning.** `fsrs()` runs with `request_retention: 0.85`,
  `maximum_interval: 365`, `enable_fuzz: true`, and `enable_short_term: false`, so
  intervals spread out and a first correct answer goes straight to long-term
  scheduling.
- **Deck generation.** `npm run build:deck -- <city>` queries Overpass (scoped to
  the city area), normalises and merges features, applies
  `scripts/curate/<city>.yaml`, and writes `data/decks/<city>.json`. The build
  script imports `parseDeck` from `src/` so generated output is validated by the
  same Zod schema the app loads. Results are cached by query hash; use
  `--refresh` to refetch from Overpass.
- **Settings.** The `meta` table (Dexie schema v3) holds a single `settings` row
  (daily new-card allowance, per-category tolerances, active city). `loadSettings`
  falls back to defaults and ignores malformed data, while `saveSettings`
  validates with Zod. The daily new-card limit feeds `buildQueue`; the Settings
  tab writes it and returns to Review.
- **Dashboard and tolerances.** The Progress tab summarises cards (new, learning,
  in review, due now, and learned per category) using `srs/stats.ts`, which joins
  the deck to stored cards. Locate tolerances are configurable per category in
  Settings; `checkLocate` accepts overrides and sessions pass the saved values.
- **Session summary.** `runSession` counts answered/correct and renders a
  summary (`.stats`) when a session finishes, alongside the finish message.
- **Deck sync.** `syncCards(city, deck)` deletes that city's cards whose feature is
  no longer in the deck before adding new ones, so regenerating a deck leaves no
  orphaned cards without disturbing other cities.
- **Queue order.** Cards are stored ranked by `${featureId}:${mode}`, so due and
  new cards would otherwise run identify and locate for a feature back to back.
  `buildQueue` finishes with a spacing pass that keeps the two modes of a feature
  apart while preserving order as far as possible.
- **City switching.** The header `<select>` persists the choice to settings and
  reloads; `app.ts` reads it before loading the deck and creating the map. The app
  opens on the Identify tab.
- **Early clicks.** Nav listeners attach before the async setup and buffer a click
  as a pending action, then replay it once the map's `style.load` has added the
  highlight layers. Without this, a tab clicked during the hosted-style fetch was
  silently dropped.
- **Deployment.** Pushing to `main` publishes to GitHub Pages via
  `.github/workflows/deploy.yml`: the workflow builds with
  `BASE_PATH=/city-learner/` and deploys `dist/`. Asset URLs are built from
  `import.meta.env.BASE_URL` so the app works from a subpath. The repository is
  public (a requirement for Pages on the free plan) and the site is live at
  `https://andywaite.com/city-learner/` on the account's custom Pages domain.


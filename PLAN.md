# City Learner — Plan

An app to learn the geography of a city: major roads, neighbourhoods, rivers/lakes,
and famous buildings/attractions. Features are memorised with spaced repetition,
tested in two directions.

## Decisions

| Area | Choice |
| --- | --- |
| Platform | Static web app (no backend) |
| Stack | Vite + TypeScript + MapLibre GL JS + Dexie (IndexedDB) |
| First city | Toronto, Ontario, Canada (city is a data parameter) |
| Deck source | OSM/Overpass generated + curated overrides |
| SRS | FSRS via `ts-fsrs` |
| Mode A answer | Multiple choice (1 correct + 3 same-category distractors) |
| Basemap | Protomaps PMTiles, custom style with all label/symbol layers removed |
| Tests | Vitest (unit) + Playwright (e2e) |

## The two modes

- **Mode A — Identify.** Highlight one feature on an unlabeled map; user picks its
  name from four options. Harder on the map, easy on the input.
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
  | { type: 'Polygon'; coordinates: [number, number][][] };

interface Feature {
  id: string;                 // stable, e.g. "osm:way/123456"
  name: string;
  aliases: string[];
  category: Category;
  description: string;
  geometry: Geometry;
  osmId?: string;
  toleranceM?: number;        // Mode B scoring radius; defaults by category
}
```

Bounds (`bbox`) and centre are *derived* from geometry at load time rather than
stored, so authored and generated decks stay lean. Types are defined with Zod
and inferred from the schema.

interface Card {
  id: string;                 // `${featureId}:${mode}`
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

- `cards` — keyed by `id`; indexed by `due`, `featureId`, `mode`.
- `meta` — deck version, city, settings, daily new-card allowance.

The deck itself is a static JSON file loaded read-only; only card state is persisted.

## Answer scoring

**Mode A (multiple choice)**
- Correct → `Good`.
- Incorrect → `Again`; show the correct name and description as feedback.
- Distractors: 3 other features from the same category, deterministic per card
  (seeded) so the UI is stable, then shuffled.

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
- Protomaps PMTiles basemap. Build the style from a Protomaps theme, then drop
  every `symbol` layer so nothing is labelled. A test asserts no symbol layers
  remain.
- Highlight layer: a GeoJSON source plus `fill`/`line`/`circle` layers in a
  high-contrast colour, used to show the target in Mode A and feedback in both.
- Attribution: OpenStreetMap (ODbL) and Protomaps must be shown.

## Deck generation

`npm run build:deck` runs `scripts/build-deck.ts` (via `tsx`) and writes
`data/decks/toronto.json` from OpenStreetMap, guided by
`scripts/curate/toronto.yaml`.

1. Queries the Overpass API (`overpass-api.de`, falling back to
   `overpass.kumi.systems`) once per category, scoped to the City of Toronto
   administrative area (relation 324211 → area 3600324211) so neighbouring
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
   ("Bloor Street West" → "Bloor Street") and stitch into the longest
   continuous line; a per-category cap keeps the deck manageable.
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
  build-deck.ts             # Overpass -> data/decks/toronto.json
  lib/{overpass,normalise,geometry,curate}.ts
  curate/toronto.yaml       # include/exclude/manual curation
  fetch-tiles.sh            # download a Toronto PMTiles cutout
  copy-maplibre-worker.mjs  # copy MapLibre worker assets into data/
data/
  decks/toronto.json
  tiles/toronto.pmtiles     # gitignored; see fetch-tiles.sh
src/
  main.ts app.ts window.d.ts style.css
  settings.ts
  deck/{types.ts,load.ts,geometry.ts,choices.ts,distance.ts}
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
3. **Map** — label-free PMTiles basemap + highlight layer.
4. **Mode A** — multiple choice flow and scoring.
5. **Mode B** — click-to-locate and geometry distance scoring.
6. **SRS** — FSRS scheduling, session queue, persistence across reloads. ✅
7. **Real deck** — Overpass + curation script producing the Toronto deck. ✅
8. **Polish** — progress dashboard, per-category tolerances, settings, session summary. ✅

## Non-goals (v1)
- No photos or media for landmarks.
- No user accounts or cross-device sync.
- No multi-city UI (city stays a data parameter).
- No free-text answering.
- No offline/PWA mode; the basemap needs the network for label glyphs and the sprite.

## Risks / open questions

- **OSM licensing.** ODbL attribution is required wherever OSM data appears.
- **Distractor quality.** Poor distractors make Mode A trivial; validate that
  choices share category and are a similar scale.
- **Feature ambiguity.** Several roads share names (e.g. "King Street"); aliases
  and stable OSM ids mitigate this.

## Implementation notes

- **PMTiles hosting resolved.** `npm run fetch:tiles` downloads the `pmtiles` CLI
  and extracts a Toronto cutout from the Protomaps daily build into
  `data/tiles/toronto.pmtiles` (gitignored, ~23 MB at maxzoom 14). `data/` is the
  Vite `publicDir`, so it is served at `/tiles/toronto.pmtiles`.
- **MapLibre worker.** The production bundle does not emit MapLibre's worker or
  its shared chunk, so the map fails with "Worker failed to load". The `predev`
  and `prebuild` hooks run `scripts/copy-maplibre-worker.mjs` to copy
  `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into `data/`, and
  `map.ts` calls `setWorkerUrl('/maplibre-gl-worker.mjs')`.
- **Session start.** The session begins on `style.load`, not `load`, so the first
  question appears without waiting for every basemap tile to download.
- **Label reveal.** The basemap style includes all symbol layers but sets
  `visibility: none`, so nothing is labelled while answering. On submit,
  `setLabelsVisible(map, true)` reveals the labels for feedback; the next question
  hides them again. This needs the Protomaps glyphs and sprite over the network
  (`protomaps.github.io/basemaps-assets`); when offline the map still works but
  labels do not render.
- **Sessions.** `runSession` drives a queue of `ReviewItem`s and delegates each to
  `presentIdentify` / `presentLocate`, which return a promise resolved on "Next".
  `Review` builds the queue from due and new cards (`buildQueue`) and writes FSRS
  state via Dexie; `Identify` / `Locate` are unscheduled practice over the whole
  deck. Cards are keyed `${featureId}:${mode}` and created on demand by `syncCards`.
- **Deck generation.** `npm run build:deck` queries Overpass (scoped to the
  Toronto area), normalises and merges features, applies
  `scripts/curate/toronto.yaml`, and writes the 252-feature Toronto deck. The
  build script imports `parseDeck` from `src/` so generated output is validated
  by the same Zod schema the app loads. Results are cached by query hash; use
  `--refresh` to refetch from Overpass.
- **Settings.** The `meta` table (Dexie schema v2) holds a single `settings`
  row. `loadSettings` falls back to defaults and ignores malformed data, while
  `saveSettings` validates with Zod. The daily new-card limit feeds `buildQueue`;
  the Settings tab writes it and returns to Review.
- **Dashboard and tolerances.** The Progress tab summarises cards (new, learning,
  in review, due now, and learned per category) using `srs/stats.ts`, which joins
  the deck to stored cards. Locate tolerances are configurable per category in
  Settings; `checkLocate` accepts overrides and sessions pass the saved values.
- **Session summary.** `runSession` counts answered/correct and renders a
  summary (`.stats`) when a session finishes, alongside the finish message.
- **Deck sync.** `syncCards` deletes cards whose feature is no longer in the deck
  before adding new ones, so regenerating the deck leaves no orphaned cards.
- **PMTiles byte serving.** The custom Pages domain is proxied by Cloudflare,
  which can answer a `Range` request with a full `200` and no `Content-Length`;
  pmtiles' own `FetchSource` rejects that. `src/map/pmtiles.ts` registers an
  `HttpRangeSource` on the protocol that slices a full response itself, so the
  archive loads regardless of how the host handles byte serving.
- **Deployment.** Pushing to `main` publishes to GitHub Pages via
  `.github/workflows/deploy.yml`: the workflow extracts the pinned PMTiles
  cutout, builds with `BASE_PATH=/city-learner/`, and deploys `dist/`. Asset URLs
  are built from `import.meta.env.BASE_URL` so the app works from a subpath. The
  repository is public (a requirement for Pages on the free plan) and the site
  is live at `https://andywaite.com/city-learner/` on the account's custom Pages
  domain.


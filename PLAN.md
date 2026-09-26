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

Build-time script (`scripts/build-deck.ts`, run via `tsx`) plus a curation file.

1. Query Overpass for the Toronto relation/bbox:
   - roads: `highway=motorway|trunk|primary` with a `name`.
   - neighbourhoods: `place=suburb|neighbourhood`, admin boundaries.
   - water: `natural=water`, `waterway=river` with a `name`.
   - landmarks: `tourism=attraction`, `historic=*`, curated buildings.
2. Merge with `scripts/curate/toronto.yaml`:
   - `include` (names worth learning), `exclude`, and manual entries with
     descriptions/aliases/tolerance.
3. Normalise: pick representative geometry (largest ring/multipolygon), compute
   centroid and bbox, simplify with `@turf/simplify`, cap coordinate precision.
4. Emit `data/decks/toronto.json` with `{ city, version, features }`. Committed.

Open item: large-area features (rivers, big neighbourhoods) should be clipped to
the city bbox to keep geometry manageable.

## Repository layout

```
scripts/
  fetch-tiles.sh            # download a Toronto PMTiles cutout
  copy-maplibre-worker.mjs  # copy MapLibre worker assets into data/
data/
  decks/toronto.json
  tiles/toronto.pmtiles     # gitignored; see fetch-tiles.sh
src/
  main.ts app.ts window.d.ts style.css
  deck/{types.ts,load.ts,geometry.ts,choices.ts,distance.ts}
  db/schema.ts
  srs/{types.ts,scheduler.ts,queue.ts,store.ts}
  map/{map.ts,style.ts,highlight.ts,labels.ts,view.ts}
  ui/{dom.ts,session.ts,identify.ts,locate.ts}
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
7. **Real deck** — Overpass + curation script producing the Toronto deck.
8. **Polish** — progress dashboard, per-category tolerances, settings, offline PMTiles.

## Non-goals (v1)

- No photos or media for landmarks.
- No user accounts or cross-device sync.
- No multi-city UI (city stays a data parameter).
- No free-text answering.

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


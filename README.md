# City Learner

A static web app for learning the geography of a city: major roads,
neighbourhoods, rivers and lakes, and famous landmarks. Features are memorised
with spaced repetition (FSRS) and tested in two directions.

**[Live demo →](https://andywaite.com/city-learner/)**

Decks ship for Toronto, Canada and Glasgow, Scotland. Switch cities from the
header; each city's spaced-repetition progress is tracked separately.

## The two modes

- **Identify** — one feature is highlighted on a label-free map; type its name
  (free text, with fuzzy matching) or switch to four same-category options.
- **Locate** — given a name and description, click the map; the answer is scored
  by distance to the feature's geometry.

Each `(feature, mode)` pair is an independent card, so a feature counts as
learned only once it can be both recognised and placed. A **Review** session
serves due and new cards through FSRS; **Identify** and **Locate** run
unscheduled practice over the whole deck. The app opens on the **Identify** tab.

## Getting started

```sh
npm install
npm run dev
```

Decks for Toronto and Glasgow ship in `data/decks/`; the basemap is loaded
from a hosted vector-tile service (see [Remote services](#remote-services)).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:deck -- <city>` | Regenerate a city deck (default `toronto`) from OpenStreetMap |

## Architecture

A single-page TypeScript app built with Vite. There is no backend: each city's
deck is a static JSON file and all progress lives in IndexedDB, tracked
separately per city.

```
src/
  app.ts            app shell, city switcher, wires map + sessions + persistence
  deck/             deck schema (Zod), city registry, loader, geometry, choices, distance, matching
  map/              MapLibre setup, label-free hosted style, highlight/guess layers, label reveal
  srs/              FSRS scheduling, due/new queue, per-city card store
  db/schema.ts      Dexie database (cards table, indexed by city)
  ui/               presenters for each mode and the shared session runner
```

Data flow for a review session: `app.ts` syncs cards for the active city, loads
them from IndexedDB, builds a queue of due and new cards, then runs each through
`ui/session.ts`. A presenter (`identify.ts` / `locate.ts`) renders the question
and resolves when the learner continues; the answer is rated `Good`/`Again` and
written back through `srs/scheduler.ts` and `srs/store.ts`.

Map rendering: the hosted basemap style is fetched and every symbol layer is set
to `visibility: none`, so the map is unlabelled while answering. On submit the
symbol layers are revealed for feedback, then hidden again for the next
question.

## Deck generation

`npm run build:deck -- <city>` (`scripts/build-deck.ts`) turns OpenStreetMap data
into `data/decks/<city>.json`, guided by `scripts/curate/<city>.yaml` (default
city is `toronto`). It:

1. queries Overpass once per category, scoped to the city's administrative
   area;
2. normalises geometry (clip to bounds, Douglas–Peucker simplification, 6 dp
   precision) and assembles relations into polygons;
3. merges features sharing a name (roads fold directional suffixes and stitch
   connected ways into runs, stored as a `MultiLineString` so a whole street is
   one feature rather than many fragments);
4. applies curation — `include`/`exclude` lists and `manual` entries that patch
   generated features or add standalone ones (e.g. Lake Ontario);
5. writes a deck validated with the app's own Zod schema.

Responses are cached under `scripts/.cache/` (gitignored, keyed by query hash);
pass `--refresh` to refetch. The generated deck is committed so no build step is
needed to run the app or tests; the basemap itself is fetched from OpenFreeMap at
runtime.

## Remote services

The app has no backend; these are the only external services it uses.

| Service | When | Purpose |
| --- | --- | --- |
| [Overpass API](https://overpass-api.de/) (`overpass-api.de`, fallback `overpass.kumi.systems`) | Build time (`build:deck`) | Source the raw OSM features for the deck. Cached; not contacted at runtime. |
| [OpenFreeMap](https://openfreemap.org/) (`tiles.openfreemap.org`) | Runtime | Hosted vector-tile basemap style, tiles, glyphs and sprites. The style is fetched once per load and its labels are hidden until a question is answered. |

No user data leaves the browser; the app sends no requests of its own beyond
fetching the basemap and static deck files.

## Deployment

Live at **[andywaite.com/city-learner](https://andywaite.com/city-learner/)**.

Pushing to `main` deploys via `.github/workflows/deploy.yml`: the workflow
builds with `BASE_PATH=/city-learner/` and publishes `dist/` to GitHub Pages.
Asset URLs are derived from `import.meta.env.BASE_URL`, so set `BASE_PATH` when
building for a different path (defaults to `/`).

Pages uses **GitHub Actions** as its source, and the repository is public so
Pages and Actions are available without a paid plan. Project sites are served
under the account's custom Pages domain (`andywaite.com`).

## Attribution and licensing

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors,
available under the ODbL, rendered with
[OpenFreeMap](https://openfreemap.org/) (OpenMapTiles schema). Attribution is
shown on the map.

## Testing

Vitest covers deck parsing, geometry, distance scoring, answer matching, choice
building, FSRS scheduling, the card queue and per-city store, settings, and the
deck-generation helpers. Playwright drives the real app — boot, unlabelled
basemap, both modes, answer modes, city switching, label reveal, and IndexedDB
persistence across reloads.

## Status

Milestones 1–7 are complete (scaffold, deck model, map, both modes, SRS, and the
generated Toronto deck). Decks for Toronto and Glasgow ship with a city switcher
and per-city progress. See `PLAN.md` for details and remaining polish items.

# City Learner

A static web app for learning the geography of a city: major roads,
neighbourhoods, rivers and lakes, and famous landmarks. Features are memorised
with spaced repetition (FSRS) and tested in two directions.

Toronto, Ontario, Canada ships as the first deck.

## The two modes

- **Identify** — one feature is highlighted on a label-free map; pick its name
  from four same-category options.
- **Locate** — given a name and description, click the map; the answer is scored
  by distance to the feature's geometry.

Each `(feature, mode)` pair is an independent card, so a feature counts as
learned only once it can be both recognised and placed. A **Review** session
serves due and new cards through FSRS; **Identify** and **Locate** run
unscheduled practice over the whole deck.

## Getting started

```sh
npm install
npm run fetch:tiles   # downloads the Toronto PMTiles basemap (~23 MB, gitignored)
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:deck` | Regenerate `data/decks/toronto.json` from OpenStreetMap |
| `npm run fetch:tiles` | Extract a Toronto PMTiles basemap cutout |

## Architecture

A single-page TypeScript app built with Vite. There is no backend: the deck is a
static JSON file and all progress lives in IndexedDB.

```
src/
  app.ts            app shell, navigation, wires map + sessions + persistence
  deck/             deck schema (Zod), loader, geometry helpers, MC choices, distance scoring
  map/              MapLibre setup, label-free style, highlight/guess layers, label reveal
  srs/              FSRS scheduling, due/new queue, card store
  db/schema.ts      Dexie database (cards table)
  ui/               presenters for each mode and the shared session runner
```

Data flow for a review session: `app.ts` syncs cards for the deck, loads them
from IndexedDB, builds a queue of due and new cards, then runs each through
`ui/session.ts`. A presenter (`identify.ts` / `locate.ts`) renders the question
and resolves when the learner continues; the answer is rated `Good`/`Again` and
written back through `srs/scheduler.ts` and `srs/store.ts`.

Map rendering: the Protomaps basemap style is loaded with every symbol layer set
to `visibility: none`, so the map is unlabelled while answering. On submit the
symbol layers are revealed for feedback, then hidden again for the next
question.

## Deck generation

`npm run build:deck` (`scripts/build-deck.ts`) turns OpenStreetMap data into
`data/decks/toronto.json`, guided by `scripts/curate/toronto.yaml`. It:

1. queries Overpass once per category, scoped to the City of Toronto
   administrative area;
2. normalises geometry (clip to bounds, Douglas–Peucker simplification, 6 dp
   precision) and assembles relations into polygons;
3. merges features sharing a name (roads fold directional suffixes and stitch
   into the longest continuous line);
4. applies curation — `include`/`exclude` lists and `manual` entries that patch
   generated features or add standalone ones (e.g. Lake Ontario);
5. writes a deck validated with the app's own Zod schema.

Responses are cached under `scripts/.cache/` (gitignored, keyed by query hash);
pass `--refresh` to refetch. The generated deck is committed so the app and tests
run offline.

## Remote services

The app has no backend; these are the only external services it uses.

| Service | When | Purpose |
| --- | --- | --- |
| [Overpass API](https://overpass-api.de/) (`overpass-api.de`, fallback `overpass.kumi.systems`) | Build time (`build:deck`) | Source the raw OSM features for the deck. Cached; not contacted at runtime. |
| [Protomaps daily builds](https://build.protomaps.com/) | Build time (`fetch:tiles`) | Download the global PMTiles extract, then cut out Toronto with the `go-pmtiles` CLI. The cutout is served locally. |
| [Protomaps basemap assets](https://protomaps.github.io/basemaps-assets/) | Runtime | Glyph (`fonts/{fontstack}/{range}.pbf`) and sprite (`sprites/v4/light`) assets required to render map labels. Without them the map still renders but labels are blank. |

There is no runtime tile server — map tiles come from the local
`data/tiles/toronto.pmtiles` file. No user data leaves the browser.

## Deployment

Live at **https://andywaite.com/city-learner/**.

Pushing to `main` deploys via `.github/workflows/deploy.yml`: the workflow
extracts the Toronto PMTiles cutout (pinned Protomaps build, cached between
runs), builds with `BASE_PATH=/city-learner/`, and publishes `dist/` to GitHub
Pages. Asset URLs are derived from `import.meta.env.BASE_URL`, so set
`BASE_PATH` when building for a different path (defaults to `/`).

Pages uses **GitHub Actions** as its source, and the repository is public so
Pages and Actions are available without a paid plan. Project sites are served
under the account's custom Pages domain (`andywaite.com`).

The custom domain sits behind a proxy that does not reliably honour HTTP range
requests, so the app registers a small `HttpRangeSource` for pmtiles
(`src/map/pmtiles.ts`) that slices a full response itself when the host ignores
`Range`. This keeps the basemap working locally and behind such proxies.

## Attribution and licensing

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors,
available under the ODbL, and rendered with
[Protomaps](https://protomaps.com). Attribution is shown on the map.

## Testing

Vitest covers deck parsing, geometry, distance scoring, choice building, FSRS
scheduling, the card queue and store, and the deck-generation helpers. Playwright
drives the real app — boot, unlabelled basemap, both modes, label reveal, and
IndexedDB persistence across reloads.

## Status

Milestones 1–7 are complete (scaffold, deck model, map, both modes, SRS, and the
generated Toronto deck). See `PLAN.md` for details and remaining polish items.

# Bible Strong Site

The Bible Strong public site uses [TanStack Start](https://tanstack.com/start), TanStack Router file-based routing, Tailwind CSS v4, and shadcn/ui primitives.

## Development

The [Bible Strong Brand Guidelines](../../docs/charte-graphique.md) document [Illustrated Worlds](../../docs/design/illustrations.md), with visual references and prompts for creating scenes consistent with the site and application illustrations.

From the monorepo root:

```bash
yarn install
yarn dev:site
```

The application is available at `http://localhost:3000`.

## Validation

```bash
yarn workspace @bible-strong/site typecheck
yarn workspace @bible-strong/site build
```

Routes live in `src/routes`. Generate `src/routeTree.gen.ts` with `yarn workspace @bible-strong/site generate-routes`.

The shadcn/ui components live in `components/ui`; theme variables, fonts, and global editorial styles are defined in `src/styles.css`.

## Deployment

The site runs as a Cloudflare Worker, `bible-strong-site` (ADR-0083, `wrangler.jsonc`). The build writes the Worker to `dist/server` and the public files to `dist/client`; `vite dev` and `vite preview` run it in the Workers runtime too. Cloudflare builds and deploys it from `master`. By hand:

```bash
yarn workspace @bible-strong/site deploy
```

- **Public files** (`public/`, the browser build) are answered by Cloudflare without running the Worker. `public/_headers` sets their headers.
- **Pages** are kept by Cloudflare, in a cache in front of the entrypoint that renders them and shared by every data centre (ADR-0084, `src/server.ts`). A page is kept a month, then served stale for a week while a new one is rendered. Every answer says so in `Cf-Cache-Status` (`HIT`, `MISS`, `BYPASS`…). An answer whose route says nothing about its keeping is not kept. The trial Worker (`yarn workspace @bible-strong/site deploy:next`) has the same cache, and `vite dev` none.
- **The Resource API** is asked through a binding (`RESOURCE_API`); on a development machine the binding reaches the deployed API, which needs `wrangler login`.
- **Share images** are drawn by the Worker. The layout library cannot start in a Worker as it is published; `bundling/satoriForWorkers.ts` rewrites it as it is bundled, and fails the build if a release moves what it rewrites.
- **Secrets** are set with `wrangler secret put`: `SHARE_CARD_SECRET`, `FIREBASE_PRIVATE_KEY` and `CACHE_REFRESH_SECRET`. In development they are read from `.env.local`.
- A library that starts a timer or asks the network when it is loaded cannot be loaded by the Worker: the animation library of the home page is replaced on the server (`bundling/animationsOnServer.ts`).

### Rendering kept pages again

A page is kept a month. Two things replace it sooner:

- **A deployment of another build.** The key of a page carries the revision of the build, a digest of everything the Worker is made of (`bundling/buildRevision.ts`). A deployment that changes nothing of it (a test, a script, this file) keeps every page; any other starts anew.
- **A request of the operator**, after a resource is republished or the Resource API deployed:

```bash
yarn site:pages:refresh --everything
yarn site:pages:refresh /bible/lsg /commentary/fr/mhy-fr   # the pages under those folders, up to three levels
```

A deployment of the Resource API refreshes nothing by itself: the operator names what changed. The command needs `CACHE_REFRESH_SECRET`, in the environment or in `apps/site/.env.local`.

### Warming the caches after a deployment

A deployment of another build starts with no kept page, and a deployment of the Resource service empties the API cache pages are rendered from (its key carries the Worker version). The first reader of each page then pays for the whole render. `scripts/warm-site-cache.mjs` requests pages so that this reader is the script. A page it renders is kept for every data centre; the API cache it fills belongs to the data centre nearest to the machine it runs on. Run it after the last of the deployments of the day, starting with the Worker's:

```bash
node apps/site/scripts/warm-site-cache.mjs --dry-run             # what would be requested, and for how long
node apps/site/scripts/warm-site-cache.mjs                       # the entry pages and the lists
node apps/site/scripts/warm-site-cache.mjs --preset chapters
node apps/site/scripts/warm-site-cache.mjs --preset chapters --resume
node apps/site/scripts/warm-site-cache.mjs --sitemap bible-lsg-verses.xml --limit 2000
```

It reads `/sitemap.xml` and the sitemaps it lists, sends only `GET` requests to those and to the pages they name, and needs no secret. `--help` lists the options. The presets, with what they select on 8 October 2026 and how long a run takes at its default rate:

| Preset     | Pages                                                             |        Number | Pages a minute |        Time |
| ---------- | ----------------------------------------------------------------- | ------------: | -------------: | ----------: |
| `entry`    | The entry page and the lists of every section (default)           |           574 |             19 |      35 min |
| `chapters` | The chapters of the ten best-known Bibles, read as text           |        11,889 |             60 |  3 h 40 min |
| `strong`   | The entry page of every Strong number, in both languages          |        39,154 |             41 | 17 h 30 min |
| `bibles`   | The chapters of every Bible in every reading mode                 |        83,328 |             60 | 25 h 30 min |
| `study`    | Dictionary articles and terms, topics, commentaries, timeline     |        87,216 |             19 |    3 d 12 h |
| `all`      | Every page `/sitemap.xml` leads to                                |       209,850 |             19 |    8 d 10 h |
| `verses`   | The verse pages of the ten best-known Bibles (31,171 for the LSG) | about 312,000 |             19 |   12 d 13 h |

Presets combine (`--preset entry,chapters`), and `--sitemap` takes a sitemap by name or by pattern (`'commentary-*-fr.xml'`). The verse sitemaps are not in `/sitemap.xml` and no pattern takes them: they are requested only with `--preset verses` or by their full name. The API keeps what a run reads for thirty days, across its deployments; a deployment of the site that changes its code renders every page again.

**Rate.** The Resource API allows the site 1,000 reads a minute, shared with readers and crawlers. A run takes every read to count, answered from the API cache or not, and takes a quarter of the allowance for its dearest page: 13 reads for a verse page (19 pages a minute), 6 for a Strong page (41), 3 for a chapter (60, the highest default); a page nobody measured counts as 13. `--rate` changes it, up to three quarters of the allowance. These numbers are in `scripts/siteWarmup.mjs`; change them there when the limit or the pages change.

**Trouble.** A 429, a 5xx, a request without answer or an incomplete page pauses the whole run for one minute, then two, then four, and halves the rate each time; the next one stops the run. A page in trouble is requested once more, at least 90 seconds later. A 401 or a 403 stops the run at once.

A page rendered from an answer the Resource API marked `STALE` carries `X-Page-Stale`, and the site keeps it a minute. Since the API keeps its cache across deployments (ADR-0076, amended), it no longer answers `STALE`; the handling stays for a Worker older than that. Such a page is not trouble: the run requests it again 75 seconds later.

An incomplete page is known by the `X-Page-Incomplete` header the site sends with it. A deployment older than that header, and a page that does not send it, cannot be told from a whole page in one request: Vercel answers both with the same `Cache-Control`. The run therefore requests again one rendered page in ten (`--verify`) 75 seconds later: a whole page is still in the CDN, an incomplete one was kept a minute and is rendered again, which counts as trouble.

**Report.** A run ends with how many pages the CDN already held (`x-vercel-cache: HIT`), how many were rendered and how long both took, what failed, and where it stopped. It writes every answer to a journal under `node_modules/.cache/site-warmup/`; `--resume` skips the pages the journal shows warm for less than a day. A run fills the API cache for readers everywhere, since the site renders in Frankfurt wherever the reader is. It fills the CDN where it is run from: the report names the region that answered, and whether the CDN shares a page with its other regions has not been measured.

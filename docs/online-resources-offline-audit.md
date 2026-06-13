# Audit: online-first resources with optional offline access

Date: 2026-06-13

## Summary

Product goal: Bible Strong should be usable immediately online, while still allowing users to make any resource available offline. Offline downloads become a user choice, not an entry requirement.

Target decision: build every major resource around domain interfaces that can read from local storage or from online endpoints. Each important resource should have two adapters:

- a local adapter backed by SQLite, JSON, or partial cache;
- a remote adapter backed by HTTP endpoints and network cache.

Local vs remote selection should be invisible to screens. Screens should request a chapter, Strong entry, Nave search, dictionary definition, commentary, or cross reference through a stable interface, not through direct SQL or local file assumptions.

## Current State

### UX

- The app opens a blocking onboarding flow when the default Bible version is not installed.
- The current check happens in `src/features/onboarding/OnBoarding.tsx`: when `getIfVersionNeedsDownload(defaultVersion)` returns true, onboarding opens and `deleteAllDatabases()` is called.
- The downloads screen already manages Bible versions, resource databases, filters, deletion, redownload, and the download queue.
- Some contextual resources already ask the user to download at point of use, but this is not an online mode. For example, Tresor and `useResourceDatabaseAccess` download a local database before use.

### Bible Reading

- Regular Bible versions are downloaded as JSON from the CDN and inserted into `bibles.sqlite`.
- Chapter loading goes through `loadBibleChapter`, which routes to:
  - `getChapterVerses` for regular versions;
  - `loadInterlineaireChapter` for `INT` / `INT_EN`;
  - `loadStrongChapter` for `LSGS` / `KJVS`.
- `biblesDb` already exposes a useful interface for chapter reads, single verse reads, multiple verse reads, version coverage, and FTS search.
- Bible search depends heavily on local SQLite FTS5. Remote search should be a dedicated server capability instead of copying SQL assumptions to the client.

### Study Resources

| Resource | Approx. size | Current state |
|---|---:|---|
| STRONG | 34.9 MB | Local SQLite, FR/EN |
| DICTIONNAIRE | 22.5 MB | Local SQLite, FR/EN |
| NAVE | 7.4 MB | Local SQLite, FR/EN |
| TRESOR | 5.4 MB | Shared local SQLite |
| MHY | 6.6 MB | Local SQLite, FR only |
| TIMELINE | 3.2 MB | Local JSON, FR/EN |
| Regular Bible versions | 37 versions, ~2.5 MB/version estimated | CDN JSON -> local SQLite |
| Red words / pericopes | JSON sidecars | Sidecar download by version |

Data volume is not the main issue: one full language set of study databases excluding interlinear is around 80 MB; all regular Bible versions are estimated around 92.5 MB. The real cost is granularity, latency, local/remote consistency, and migration away from scattered SQL access.

## Target Architecture

### Principle

Create a `ResourceAccess` layer per domain:

- `BibleContentAccess`
- `BibleSearchAccess`
- `StrongAccess`
- `InterlinearAccess`
- `DictionaryAccess`
- `NaveAccess`
- `CrossReferenceAccess`
- `CommentaryAccess`
- `TimelineAccess`
- `BibleSidecarAccess` for red words and pericopes

Each interface should hide:

- local vs remote;
- cache;
- offline state;
- download status;
- version and language;
- invalidation and updates;
- resource support and availability errors;
- format differences between SQLite, JSON, and HTTP.

### Adapters

Each interface should have at least:

- a local adapter reading existing SQLite/JSON/cache data;
- a remote adapter calling HTTP endpoints;
- an orchestrator choosing local, cache, or remote based on network state, offline preferences, and resource availability.

Default selection rule:

1. use the local resource if it is installed and current;
2. use partial cache if available;
3. use remote data if the network is available;
4. return an actionable offline error if no source is available.

### Remote Granularity

Remote endpoints should be granular enough for online usage:

- Bible: chapter, verse, multiple verses, version coverage.
- Bible search: server endpoint with pagination, version/book/testament filters, relevance and canonical-order sorting.
- Strong: Strong chapter, entry lookup, list by letter, search, concordance.
- Interlinear: chapter by language.
- Dictionary: entry, search, list by letter, words linked to a verse.
- Nave: entry, search, list by letter, topics linked to a verse.
- Tresor: cross references by verse.
- MHY: comments by chapter.
- Timeline: periods, events, event detail.
- Sidecars: red words and pericopes by version or chapter.

Complete files remain useful for offline installation, but they should no longer be the only way to use a resource.

## Target UX

### First Launch

- The app opens directly into the workspace.
- If internet is available, the default Bible chapter loads online.
- If internet is unavailable and no local resource is installed, the app shows a clear offline state with actions: retry, choose an installed resource, download later.
- Onboarding becomes explanatory and dismissible, or is replaced by a "Make available offline" card.

### Bible Reading

- The main chapter loads first.
- Extras load without blocking the chapter: parallel versions, comments, red words, pericopes.
- A missing local parallel version can load online.
- Failure in a secondary resource does not break main chapter reading.
- The reader must support coherent partial states: online chapter, local annotations, unavailable comments, red words loading.

### Resources

- The Resources screen shows three states: `Online`, `Available offline`, `Update available`.
- Primary actions become: open, make available offline, remove offline copy, update.
- Packs can group downloads: basic reading, Strong study, local search, complete FR resources, complete EN resources.

### Search

- Online search covers every resource supported by endpoints.
- Offline search covers only installed resources.
- The UI should clearly show which mode is being used when results may differ.

## Effort Estimate

| Phase | Scope | Estimate |
|---|---|---:|
| 0 | Instrument missing resources, errors, online/offline usage, downloaded sizes | 2-4 days |
| 1 | Non-blocking UX: dismissible onboarding, online/offline states, tri-state Resources screen | 1-2 weeks |
| 2 | `ResourceAccess` infrastructure: contracts, local/cache/remote orchestrator, standardized errors | 2-3 weeks |
| 3 | Bible remote: chapter, verse, multiple verses, chapter cache, sidecars | 2-4 weeks |
| 4 | Remote Bible search with pagination and acceptable parity with offline FTS | 2-3 weeks |
| 5 | Strong + Interlinear remote adapters and endpoints | 3-5 weeks |
| 6 | Dictionary + Nave remote adapters and endpoints | 3-5 weeks |
| 7 | Tresor + MHY + Timeline remote adapters and endpoints | 2-4 weeks |
| 8 | Remove direct SQL calls from screens and migrate them to domain interfaces | 3-5 weeks |
| 9 | Hardening: observability, cache invalidation, latency tests, offline tests, progressive rollout | 2-4 weeks |

Total estimate: about 4-6 months for a clean implementation covering all resources, depending on the expected search parity and Strong/Nave/dictionary detail behavior.

## Infrastructure Cost

The following are order-of-magnitude prices verified on 2026-06-13 from official sources:

- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/): standard storage around 0.015 USD/GB-month, Class B operations around 0.36 USD/million, Internet egress free.
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): paid plan at 5 USD/month, 10M included requests, then about 0.30 USD/million + CPU; official 100M requests/month example at 7 ms average CPU is about 45.40 USD.
- [Firebase pricing](https://firebase.google.com/pricing): legacy `*.appspot.com` Storage has 5 GB free, then storage around 0.026 USD/GB; download has 1 GB/day free, then 0.12 USD/GB; download operations have 50k/day free, then 0.004 USD/10k.
- [Firebase pricing](https://firebase.google.com/pricing): Hosting has 10 GB free, 360 MB/day free transfer, then about 0.15 USD/GB.

For this project, initial infrastructure cost should stay moderate if:

- online reads are served through granular endpoints;
- responses are cacheable;
- complete files are reserved for offline installation;
- audio and large media do not move into this new layer.

Cost risk mostly comes from two mistakes:

- repeatedly serving complete files for ordinary reading or lookup flows;
- putting expensive dynamic search behind each keystroke without debounce, cache, and quotas.

## Risks

1. Local/remote parity: SQLite FTS and server search can diverge. Define acceptable parity.
2. Mobile latency: chapters and frequently used resources must be cacheable and prefetchable.
3. SQL coupling: Strong, Nave, dictionary, and comments still use scattered SQL queries. Domain interfaces should come before broad remote rollout.
4. Partial states: one page may combine online content, local annotations, missing extras, and downloading resources.
5. User data sync: notes, highlights, relations, and tabs must stay independent from this resource project.
6. Rollout: remote access must be enabled per resource and per environment to avoid blocking the whole app.

## Recommended Plan

1. Define `ResourceAccess` contracts and standardized errors.
2. Make onboarding non-blocking and update the Resources screen.
3. Implement Bible + sidecars with remote/cache/local behavior.
4. Add online Bible search.
5. Migrate Strong + Interlinear.
6. Migrate Dictionary + Nave.
7. Migrate Tresor + MHY + Timeline.
8. Gradually remove direct SQL calls from screens.
9. Add observability, offline/online tests, and rollout flags.

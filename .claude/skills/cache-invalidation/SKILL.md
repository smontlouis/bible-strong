---
name: cache-invalidation
description: Decide what to empty in the Resource API cache and the public site page cache after a change, and run `yarn cache:invalidate` for exactly that. Use after a resource publication, a correction in Neon, a re-import of cross-references, or a code change that alters what the API answers or what the public pages show; also when the user asks to invalidate, purge or refresh a cache.
---

# Cache invalidation

Deploying the Resource API or the public site never empties a cache (ADR-0076 and ADR-0084,
amended 2026-10-15). Nothing is emptied unless someone decides it. This skill finds what a change
makes stale, proposes the narrowest invalidation, and runs it only once the user agrees.

## The two caches

| Cache | Kept | Key | Emptied by |
| --- | --- | --- | --- |
| Resource API (`api.bible-strong.app`), per data centre | 30 days for reads, 1 hour for lists, 1 day for searches | content revision of the resources read + `RESOURCE_API_ANSWER_REVISION` + hand invalidations | a new catalog entry for the resource (automatic: the content changed), `yarn cache:invalidate --api <identity>` then a deployment, or a bump of the answer revision |
| Public pages (`bible-strong.app`), shared by every data centre | 30 days, plus 7 days stale-while-revalidate | site build revision + address | `yarn cache:invalidate --site <folder>` (at once), or a site deployment that changes its code |

A republished resource already gets new API keys from its new catalog entry once the Worker is
deployed. Its public pages do not: they are kept until someone refreshes their folder.

## Steps

1. **Find the change.** Read the diff the user points to (`git diff origin/master...HEAD`, a PR, or
   the publication just made). For a publication, read which catalog identities changed in
   `packages/resource-catalog/src/mobile-resource-catalog.json`.
2. **Classify each change** with the table below. Ignore what no cached answer or page shows.
3. **Propose the narrowest targets**, as API identities and site folders, with one sentence on
   why each is stale. Prefer a folder to `--site-everything`, and a resource to the answer revision.
4. **Ask before running anything.** Refreshing pages is immediate and public; an API invalidation
   changes a tracked file that must be merged and deployed.
5. **Run in order**: API first (`--api`), merge, deploy the Resource API from master
   (`yarn resources:worker:deploy`), then the site (`--site`). Pages refreshed before the
   deployment would be rendered again from the answers the API still keeps. The command refuses to
   refresh the site in the same call as an API invalidation and prints the follow-up instead.

## What to empty

| Change | API | Site |
| --- | --- | --- |
| A resource republished (new catalog entry), Worker deployed | nothing: its keys changed | the folders that show it (see below) |
| A resource corrected in Neon without a new catalog entry | `--api <identity>` | its folders |
| Cross-references imported again | `--api cross-references:<language>` | the Bible folders that show them, often `/bible` |
| A cached route answers differently for the same content (field, order, rule) | bump `RESOURCE_API_ANSWER_REVISION` in `packages/resource-service/src/runtime/resourceApiCache.ts`, or the route's own response revision there | the folders whose pages read that route |
| Site code changed (component, route, style) | nothing | nothing: the site deployment changes the build revision and every page is rendered again |
| Start-up, logs, limits, a new route, performance, tests, docs | nothing | nothing |

## Identities and folders

API identities are catalog identities, or `cross-references:fr|en`:

- `bible:<VERSION>` — site folder `/bible/<version>` as the site writes it (lower case), e.g.
  `bible:LSG` → `/bible/lsg`
- `bible-strong:<VERSION>` — `/bible/<version>/strong` and `/bible/<version>/reverse-interlinear`;
  the concordance of `/strong/<language>` counts its occurrences too
- `strong-lexicon:<module>` — `/strong`, or `/strong/<language>` for a simple lexicon
- `bible-interlinear:BHG:<language>` — `/bible/bhg/interlinear` (the folder holds both languages)
- `database:<work>:<language>` — a commentary (`/commentary/<language>/<slug>`), a dictionary
  (`/dictionary/<language>/<work>`), `database:NAVE:<language>` (`/nave/<language>`),
  `database:TIMELINE:<language>` (`/timeline/<language>`)

A commentary's site slug is not its catalog work (`database:MHY:fr` is not `/commentary/fr/MHY`):
read the address from the site, or `apps/site/features/commentary/commentaryCatalog.ts`. A folder
is at most three levels deep. Pages also read other resources (a Strong page shows Bible verses,
a Bible page shows cross-references): when a change reaches across families, name each family.

## Commands

```bash
yarn cache:invalidate --api bible:LSG database:MHY:fr --dry-run   # what would change
yarn cache:invalidate --api bible:LSG database:MHY:fr             # writes resourceApiInvalidations.json
yarn cache:invalidate --site /bible/lsg /commentary/fr/mhy-fr      # after the API deployment
yarn cache:invalidate --site-everything                            # last resort
```

`--site` needs `CACHE_REFRESH_SECRET`, in the environment or in `apps/site/.env.local`.

## Checking

- API: `curl -sD - -o /dev/null <url> | grep -i x-resource-cache` gives `MISS` on the first read
  of an invalidated resource after the deployment, then `HIT`.
- Site: `curl -sI <page> | grep -i cf-cache-status` gives `MISS` once after the refresh, then `HIT`.

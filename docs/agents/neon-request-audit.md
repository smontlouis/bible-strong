# Neon Request Audit

## Scope

This audit covers the production Resource API path from the mobile client through the Cloudflare
Worker and Hyperdrive to Neon PostgreSQL. Firestore and user-owned synchronization are excluded.

## Request baseline and result

| User operation | Before | After |
| --- | ---: | ---: |
| Global search with Bible, Strong, dictionary, and Nave enabled | 15 HTTP requests per page (12 Bible versions plus 3 other resources) | 4 HTTP requests per page |
| Bible search without an explicit version | 12 HTTP requests and up to 24 SQL statements | 1 HTTP request and 1 SQL statement |
| Two plain parallel Bible versions | 2 HTTP requests and 2 SQL statements | 1 HTTP request and 1 SQL statement |
| N Strong entry cards | N HTTP requests and SQL work proportional to N | 1 HTTP request and 7 SQL statements independent of N in the batch repository path |
| Identical attested search inside 60 seconds | 1 Neon read per request | 1 Neon read on MISS, then 0 on HIT |

The Strong card batch statement count was measured against the complete local publication database
with `G3056` and `H3068`: both cards were returned with seven statements total. The previous path ran
the full `findEntry` query sequence independently for each identity.

Client-side amplification is also bounded:

- search input debounce is 600 ms instead of 300 ms;
- superseded Bible, Strong, dictionary, and Nave requests receive the TanStack Query abort signal;
- automatic search retries are disabled; users retain the explicit retry action;
- TanStack Query continues to deduplicate requests with the same query key.

## PostgreSQL plan evidence

`EXPLAIN (ANALYZE, BUFFERS)` was run on the local production-shaped database containing 1,374,869
Bible verse rows. A four-version search for a common French term completed in 80.499 ms and returned
the page plus total count through one statement. PostgreSQL used:

- `resource_publications_one_active_identity` for active publication lookup;
- `bible_verses_text_trigram` for case-insensitive text matching;
- `bible_verses_chapter_lookup` for publication filtering;
- a 1.7 MB in-memory quicksort for 7,574 matches.

The plan showed no sequential scan of `bible_verses`. The total count requires consuming all
matches; production p95 latency should decide whether a separate approximate/count-on-demand mode
is worthwhile later.

## Production measurement

The Worker emits one sampled structured `resource API request` event without search text or
user-authored content. The event contains request class, route path, status, edge-cache HIT/MISS/
BYPASS, whether the origin was read, SQL statement count, total Worker duration, and request ID.

For a representative seven-day window after deployment, group these events by `path` and `cache`
to compare:

- request volume per route;
- `HIT / (HIT + MISS)` cache-hit ratio;
- p50, p95, and p99 Worker duration;
- origin-read volume.

Correlate the same window in Hyperdrive and Neon with connection count, query count, database p95
latency, rows read, and compute time. Search values must not be added to logs. Compare the first
seven complete days with the preceding seven days, normalized by Resource API active devices.

Rollback signals are a higher error rate, p95 regression, unexpected cache staleness, or Neon query
volume that does not fall with the new aggregate routes. Search cache staleness is bounded to 60
seconds. Deterministic cache keys use the embedded publication content revision where a route maps
to one resource; aggregate routes use the complete catalog revision.

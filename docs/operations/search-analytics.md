# Search analytics operations

## Cloudflare resources

The production Worker expects:

- Analytics Engine dataset `bible_search_product_v1`;
- Analytics Engine dataset `bible_search_runtime_v1`;
- the account AI Gateway `default`, automatically provisioned by Cloudflare on its first authenticated inference.

`SEARCH_ANALYTICS_ENABLED` is the server-side kill switch. Set it to `false` and redeploy the Worker to stop product events, runtime datapoints and AI Gateway logs while leaving search functional.

The event endpoint has its own App Check-backed rate-limit binding (`SEARCH_ANALYTICS_RATE_LIMITER`). Analytics traffic must not consume the budget reserved for actual search requests.

AI Gateway logging is metadata-only. The Worker sends `cf-aig-collect-log-payload: false`, so Cloudflare keeps model, cost, token, status and duration metadata without storing the embedding input or output. Do not remove this header: query content is intentionally stored only in the controlled Product dataset.

## Generate a report

Create a Cloudflare API token with `Account Analytics Read`, then run:

```bash
CLOUDFLARE_ACCOUNT_ID=... \
CLOUDFLARE_API_TOKEN=... \
yarn resources:analytics:search --days=30
```

The accepted range is 1–90 days. The command prints JSON and never writes the token or report to the repository. Query reports exclude formulations observed fewer than five weighted times.

Analytics Engine uses adaptive sampling. Every count and average must use `_sample_interval`; never replace the weighted expressions with `COUNT(*)` or a plain `AVG`.

## Dataset field map

### Product blobs

1. event
2. sanitized query
3. normalized grouping key
4. language
5. origin (`typed` or `example`)
6. input kind
7. enabled public sources
8. selected Bible versions
9. outcome
10. passage match kind
11. topic ID
12. opened result type
13. opened result key

### Product doubles

1. total public results
2. reference results
3. passage results
4. Strong results
5. dictionary results
6. Nave results
7. client duration in milliseconds
8. opened result rank
9. query length
10. example flag

### Runtime blobs

1. event
2. environment
3. logical route
4. status
5. cache status
6. model
7. embedding contract
8. error class

### Runtime doubles

1. duration in milliseconds
2. SQL statement count
3. origin-read flag
4. success flag

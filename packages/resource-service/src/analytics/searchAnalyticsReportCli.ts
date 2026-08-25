const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim()
const daysArgument = process.argv.find(argument => argument.startsWith('--days='))?.split('=')[1]
const days = Number(daysArgument ?? 30)

if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID_REQUIRED')
if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN_REQUIRED')
if (!Number.isInteger(days) || days < 1 || days > 90) {
  throw new Error('SEARCH_ANALYTICS_DAYS_MUST_BE_BETWEEN_1_AND_90')
}

const dataset = process.env.SEARCH_PRODUCT_ANALYTICS_DATASET ?? 'bible_search_product_v1'
const runtimeDataset = process.env.SEARCH_RUNTIME_ANALYTICS_DATASET ?? 'bible_search_runtime_v1'
const datasetNamePattern = /^[A-Za-z0-9_]{1,64}$/u
if (!datasetNamePattern.test(dataset) || !datasetNamePattern.test(runtimeDataset)) {
  throw new Error('SEARCH_ANALYTICS_DATASET_NAME_INVALID')
}
const since = `timestamp >= NOW() - INTERVAL '${days}' DAY`

const queryAnalyticsEngine = async (sql: string): Promise<unknown> => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiToken}`,
        'content-type': 'text/plain',
      },
      body: sql,
    }
  )
  const payload: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new Error(`SEARCH_ANALYTICS_QUERY_FAILED:${response.status}:${JSON.stringify(payload)}`)
  }
  return payload
}

const reports = {
  summary: `
    SELECT
      blob4 AS language,
      blob6 AS input_kind,
      blob9 AS outcome,
      blob10 AS match_kind,
      SUM(_sample_interval) AS searches,
      SUM(_sample_interval * double1) AS reported_results,
      SUM(_sample_interval * double7) / SUM(_sample_interval) AS avg_duration_ms
    FROM ${dataset}
    WHERE ${since} AND blob1 = 'search_performed'
    GROUP BY language, input_kind, outcome, match_kind
    ORDER BY searches DESC
  `,
  topQueries: `
    SELECT
      blob2 AS query,
      blob3 AS query_key,
      blob4 AS language,
      blob6 AS input_kind,
      blob10 AS match_kind,
      blob11 AS topic_id,
      SUM(_sample_interval) AS searches,
      SUM(IF(blob9 = 'zero_results', _sample_interval, 0)) AS zero_results,
      SUM(_sample_interval * double1) AS reported_results
    FROM ${dataset}
    WHERE ${since} AND blob1 = 'search_performed'
    GROUP BY query, query_key, language, input_kind, match_kind, topic_id
    HAVING SUM(_sample_interval) >= 5
    ORDER BY searches DESC
    LIMIT 250
  `,
  searchToOpen: `
    SELECT
      blob2 AS query,
      blob3 AS query_key,
      blob4 AS language,
      SUM(IF(blob1 = 'search_performed', _sample_interval, 0)) AS searches,
      SUM(IF(blob1 = 'result_opened', _sample_interval, 0)) AS first_result_opens
    FROM ${dataset}
    WHERE ${since}
    GROUP BY query, query_key, language
    HAVING SUM(IF(blob1 = 'search_performed', _sample_interval, 0)) >= 5
    ORDER BY searches DESC
    LIMIT 250
  `,
  openedResultTypes: `
    SELECT
      blob12 AS result_type,
      SUM(_sample_interval) AS opens,
      SUM(_sample_interval * double8) / SUM(_sample_interval) AS avg_rank
    FROM ${dataset}
    WHERE ${since} AND blob1 = 'result_opened'
    GROUP BY result_type
    ORDER BY opens DESC
  `,
  runtime: `
    SELECT
      blob1 AS event,
      blob3 AS route,
      blob4 AS status,
      blob5 AS cache,
      blob6 AS model,
      blob8 AS error_class,
      SUM(_sample_interval) AS events,
      SUM(_sample_interval * double1) / SUM(_sample_interval) AS avg_duration_ms,
      quantileExactWeighted(0.95)(double1, _sample_interval) AS p95_duration_ms,
      SUM(_sample_interval * double4) / SUM(_sample_interval) AS success_rate
    FROM ${runtimeDataset}
    WHERE ${since}
    GROUP BY event, route, status, cache, model, error_class
    ORDER BY events DESC
  `,
}

const entries = await Promise.all(
  Object.entries(reports).map(
    async ([name, sql]) => [name, await queryAnalyticsEngine(sql)] as const
  )
)

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      days,
      minimumDisplayedQueryCount: 5,
      reports: Object.fromEntries(entries),
    },
    null,
    2
  )
)

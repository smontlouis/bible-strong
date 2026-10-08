// Requests pages of the public site after a deployment, so that the CDN holds the rendered
// pages and the Resource API holds what they read. It takes its list from the sitemaps of
// the site, sends nothing but GET requests to its sitemaps and its pages, and needs no
// secret. The rules it follows are in `siteWarmup.mjs`; how and when to run it is in the
// README of the site.
//
//   node apps/site/scripts/warm-site-cache.mjs --dry-run
//   node apps/site/scripts/warm-site-cache.mjs --preset entry
//   node apps/site/scripts/warm-site-cache.mjs --help
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  describeTrouble,
  estimateRunMs,
  formatDuration,
  isKeptWhenWhole,
  isSitemapDocument,
  judge,
  parseSitemapIndex,
  readAnswer,
  readOptions,
  resolveRate,
  RETRY_DELAY_MS,
  selectSitemaps,
  signalOf,
  sitemapPauseMs,
  startPace,
  summarize,
  takePages,
  USAGE,
  VERIFY_DELAY_MS,
  warmPaths,
} from './siteWarmup.mjs'

const site = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUEST_HEADERS = {
  'user-agent': 'bible-strong-site-warmup (+https://bible-strong.app)',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}
const TIMEOUT_MS = 45_000
const PROGRESS_EVERY_MS = 30_000

const count = number => number.toLocaleString('en-US')
const clock = () => new Date().toTimeString().slice(0, 8)
const say = line => console.log(line)
const note = line => console.log(`${clock()}  ${line}`)

let options
try {
  options = readOptions(process.argv.slice(2))
} catch (cause) {
  console.error(`${cause.message}\n\nSee --help.`)
  process.exit(1)
}
if (options.help) {
  say(USAGE)
  process.exit(0)
}
const { origin } = options

let requests = 0
/**
 * The only request the tool makes: a GET of an address of the site, redirects not followed.
 * A request that gets no answer comes back with status 0.
 */
const get = async path => {
  const url = `${origin}${path}`
  if (!path.startsWith('/') || new URL(url).origin !== origin) {
    throw new Error(`Not an address of ${origin}: ${path}`)
  }
  requests += 1
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = await response.text()
    const headers = Object.fromEntries(response.headers)
    return { status: response.status, headers, body, ms: elapsed() }
  } catch (cause) {
    return { status: 0, headers: {}, body: '', ms: elapsed(), error: cause.message }
  }
}

let wake = () => {}
const sleep = ms =>
  new Promise(done => {
    const timer = setTimeout(done, ms)
    wake = () => {
      clearTimeout(timer)
      done()
    }
  })

// ---------------------------------------------------------------------------------------
// The plan: the sitemaps, then the pages they list
// ---------------------------------------------------------------------------------------

const giveUp = (line, status = 2) => {
  console.error(line)
  process.exit(status)
}

const index = await get('/sitemap.xml')
if (index.status !== 200 || !isSitemapDocument(index.body)) {
  giveUp(
    `${origin}/sitemap.xml answered ${index.status || index.error}: nothing was requested after it.`
  )
}
const sitemaps = selectSitemaps(
  parseSitemapIndex(index.body, origin),
  options.rules,
  options.exclude
)
if (!sitemaps.length) {
  giveUp('No sitemap matches the selection. A verse sitemap is only taken by its full name.', 1)
}

let rate
try {
  rate = resolveRate(
    options.rate,
    sitemaps.map(sitemap => sitemap.name)
  )
} catch (cause) {
  giveUp(cause.message, 1)
}

say(`Reading ${count(sitemaps.length)} sitemaps of ${origin}`)
/** @type {{ path: string, sitemap: string }[]} */
const plan = []
const planned = []
const seen = new Set()
let foreign = 0
for (const [position, sitemap] of sitemaps.entries()) {
  const remaining = options.limit - plan.length
  if (remaining <= 0) break
  if (position > 0) await sleep(sitemapPauseMs(sitemaps[position - 1].name))
  const answer = await get(`/sitemaps/${sitemap.name}`)
  if (answer.status === 404) {
    planned.push({ name: sitemap.name, pages: 0, problem: 'not served by the site' })
    continue
  }
  if (answer.status !== 200 || !isSitemapDocument(answer.body)) {
    giveUp(
      `/sitemaps/${sitemap.name} answered ${answer.status || answer.error}: the site is in ` +
        'trouble before the warm-up started. No page was requested.'
    )
  }
  const taken = takePages(answer.body, {
    origin,
    lists: sitemap.lists,
    limit: Math.min(options.perSitemap, remaining),
    seen,
  })
  foreign += taken.foreign
  for (const path of taken.paths) plan.push({ path, sitemap: sitemap.name })
  planned.push({ name: sitemap.name, pages: taken.paths.length, listed: taken.listed })
}

const journalPath = resolve(
  options.journal ??
    join(
      site,
      'node_modules/.cache/site-warmup',
      `${new URL(origin).host.replace(/:/gu, '_')}.jsonl`
    )
)
const warm =
  options.resume && existsSync(journalPath)
    ? warmPaths(readFileSync(journalPath, 'utf8'), Date.now())
    : new Set()
const pages = plan.filter(page => !warm.has(page.path))
const skipped = plan.length - pages.length

for (const sitemap of planned) {
  const detail = sitemap.problem ?? `${count(sitemap.pages)} of ${count(sitemap.listed)}`
  say(`  ${sitemap.name.padEnd(52)} ${detail}`)
}
if (planned.length < sitemaps.length) {
  say(`  (${count(sitemaps.length - planned.length)} sitemaps not read: the limit was reached)`)
}
if (foreign) say(`  ${count(foreign)} addresses of another site were left out`)
const estimate = estimateRunMs({ pages: pages.length, rate, verifyEvery: options.verifyEvery })
say(
  `${count(pages.length)} pages to request` +
    (options.resume ? `, ${count(skipped)} skipped as warm in the journal` : '') +
    `, at ${rate} a minute, ${options.concurrency} at a time: about ${formatDuration(estimate)}`
)

if (options.dryRun) {
  if (options.list) for (const page of pages) say(`${origin}${page.path}`)
  say(`Dry run: ${count(requests)} sitemap requests were made, and no page request.`)
  process.exit(0)
}
if (!pages.length) {
  say('Nothing to request.')
  process.exit(0)
}

// ---------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------

const sitemapRequests = requests
mkdirSync(dirname(journalPath), { recursive: true })
const journal = record => appendFileSync(journalPath, `${JSON.stringify(record)}\n`)
if (!options.resume) writeFileSync(journalPath, '')
journal({ run: { origin, at: new Date().toISOString(), pages: pages.length, rate, skipped } })

const records = []
/**
 * Pages to request again: once more after trouble, to check the CDN kept them, or to let a
 * provisional page be rendered from the answers the Resource API has refreshed.
 */
const later = []
const flying = new Set()
let pace = startPace(rate)
let next = 0
let pausedUntil = 0
let nextSlotAt = 0
let pauses = 0
let unknownRenders = 0
let answeredBy
let lastPageSentAt = 0
let stop

const describe = summary =>
  `${count(summary.pages)}/${count(pages.length)} pages · ${count(summary.cached)} cached · ` +
  `${count(summary.rendered)} rendered` +
  (summary.times.rendered ? ` (median ${count(summary.times.rendered.p50)} ms)` : '') +
  ` · ${count(summary.limited + summary.failed + summary.incomplete)} in trouble` +
  (later.length ? ` · ${count(later.length)} to request again` : '')

const request = async item => {
  const { era } = pace
  const response = await get(item.path)
  const answer = readAnswer(response)
  // A page requested again to check, and rendered again: its first render was not kept.
  const dropped = item.pass === 'verify' && answer.kind === 'rendered'
  const signal = dropped ? 'incomplete' : signalOf(answer)
  answeredBy ??= response.headers['x-vercel-id']?.split('::').slice(0, 2).join(' → ')

  const record = {
    path: item.path,
    at: new Date().toISOString(),
    kind: answer.kind,
    completeness: answer.completeness,
    status: response.status,
    ms: response.ms,
    cache: answer.cache,
    pass: item.pass,
    sitemap: item.sitemap,
  }
  records.push(record)
  journal(record)

  const verdict = judge(pace, {
    signal,
    era,
    retryAfterMs: answer.retryAfterMs,
    again: item.pass === 'retry',
  })
  pace = verdict.pace
  if (verdict.stop) stop ??= verdict.stop
  if (verdict.pauseMs) {
    pauses += 1
    pausedUntil = Date.now() + verdict.pauseMs
    note(
      `${item.path} (${response.status || response.error}): ${describeTrouble(signal)}. ` +
        `Pausing ${formatDuration(verdict.pauseMs)}, then ${pace.rate} pages a minute.`
    )
  }

  if (item.pass !== 'first') return
  if (signal === 'limited' || signal === 'failed' || signal === 'incomplete') {
    const notBefore = Date.now() + Math.max(RETRY_DELAY_MS, verdict.pauseMs ?? 0)
    later.push({ ...item, pass: 'retry', notBefore })
  } else if (answer.completeness === 'provisional') {
    // Kept a minute by the CDN: rendered again after that, it is whole and kept a day.
    later.push({ ...item, pass: 'settle', notBefore: Date.now() + VERIFY_DELAY_MS })
  } else if (
    answer.kind === 'rendered' &&
    answer.completeness === 'unknown' &&
    options.verifyEvery > 0 &&
    isKeptWhenWhole(item.path)
  ) {
    if (unknownRenders % options.verifyEvery === 0) {
      later.push({ ...item, pass: 'verify', notBefore: Date.now() + VERIFY_DELAY_MS })
    }
    unknownRenders += 1
  }
}

process.on('SIGINT', () => {
  if (stop) process.exit(130)
  stop = 'interrupted'
  note('Interrupted: waiting for the requests in flight. Press Ctrl-C again to quit now.')
  wake()
})

const startedAt = Date.now()
const progress = setInterval(() => note(describe(summarize(records))), PROGRESS_EVERY_MS)
progress.unref()

while (!stop) {
  const now = Date.now()
  if (now < pausedUntil) {
    await sleep(pausedUntil - now)
    continue
  }
  if (flying.size >= options.concurrency) {
    await Promise.race(flying)
    continue
  }
  if (now < nextSlotAt) {
    await sleep(nextSlotAt - now)
    continue
  }
  const due = later.findIndex(item => item.notBefore <= now)
  const item =
    due >= 0
      ? later.splice(due, 1)[0]
      : next < pages.length
        ? { ...pages[next++], pass: 'first' }
        : undefined
  if (!item) {
    // An answer still in flight may ask for a page again.
    if (flying.size) await Promise.race(flying)
    else if (later.length) await sleep(Math.min(...later.map(waiting => waiting.notBefore)) - now)
    else break
    continue
  }
  nextSlotAt = now + 60_000 / pace.rate
  if (item.pass === 'first') lastPageSentAt = now
  const flight = request(item).finally(() => flying.delete(flight))
  flying.add(flight)
}
await Promise.all(flying)
clearInterval(progress)

// ---------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------

const summary = summarize(records)
const elapsed = Date.now() - startedAt
// Pages a minute between the first page sent and the last: what the run asked of the site.
const pagesAMinute =
  next > 1 ? Math.round(((next - 1) / Math.max(lastPageSentAt - startedAt, 1)) * 60_000) : next
const times = distribution =>
  distribution
    ? `fastest ${count(distribution.min)} ms, median ${count(distribution.p50)}, ` +
      `9 in 10 under ${count(distribution.p90)}, 99 in 100 under ${count(distribution.p99)}, ` +
      `slowest ${count(distribution.max)}`
    : ''
const line = (label, value, detail = '') =>
  say(`  ${label.padEnd(18)}${String(value).padEnd(9)} ${detail}`.trimEnd())

journal({ end: { at: new Date().toISOString(), stop: stop ?? null, next, ...summary } })

say('')
say(
  stop
    ? `Warm-up of ${origin} stopped: ${stop}.`
    : `Warm-up of ${origin} completed: every page was requested.`
)
line(
  'Requests',
  count(requests),
  `${count(sitemapRequests)} for the sitemaps, ${count(summary.pages)} pages, ` +
    `${count(summary.retried)} requested again after trouble, ${count(summary.verified)} to ` +
    `check they were kept, in ${formatDuration(elapsed)}`
)
line('Already cached', count(summary.cached), times(summary.times.cached))
line('Served stale', count(summary.stale), times(summary.times.stale))
line('Rendered', count(summary.rendered), times(summary.times.rendered))
line('Incomplete', count(summary.incomplete), 'pages the site could not render whole')
line(
  'Provisional',
  count(summary.provisional),
  'pages rendered from answers of an earlier API version, requested again a minute later'
)
line('Limited (429)', count(summary.limited))
line('Failed', count(summary.failed), '5xx, or no answer')
line('Refused', count(summary.refused), '401 or 403')
line(
  'Not pages',
  count(summary.missing + summary.redirected),
  `${count(summary.missing)} missing, ${count(summary.redirected)} redirected`
)
if (summary.retried) {
  line('Requested again', count(summary.retried), `${count(summary.recovered)} came back a page`)
}
line(
  'Kept by the CDN',
  options.verifyEvery ? `${count(summary.kept)}/${count(summary.verified)}` : 'unchecked',
  options.verifyEvery
    ? `rendered pages still there ${VERIFY_DELAY_MS / 1000} s later, one checked in ` +
        `${options.verifyEvery} where the answer did not say`
    : ''
)
line(
  'Pace',
  `${pagesAMinute}/min`,
  `pages requested a minute from the first to the last, ${rate} allowed; paused ${count(pauses)} ` +
    `times, last rate allowed ${pace.rate}`
)
if (answeredBy) line('Answered by', answeredBy, 'CDN region, then function region')

const troubled = records.filter(record => record.pass !== 'verify' && signalOf(record) !== 'good')
for (const record of troubled.slice(0, 20)) {
  const what = record.completeness === 'incomplete' ? 'incomplete' : record.kind
  say(`    ${record.status || 'no answer'} ${what} ${record.path}`)
}
if (troubled.length > 20) say(`    … and ${count(troubled.length - 20)} more, in the journal`)

if (next < pages.length || later.length) {
  const where = pages[next]
  say(
    `  Stopped before page ${count(next + 1)} of ${count(pages.length)}` +
      (where ? `, ${where.path} (${where.sitemap})` : '') +
      `; ${count(pages.length - next)} pages not requested` +
      (later.length ? `, ${count(later.length)} not requested again` : '') +
      '. Run the same command with --resume to go on from the journal.'
  )
}
say(`  Journal: ${journalPath}`)

process.exit(stop === 'interrupted' ? 130 : stop ? 2 : 0)

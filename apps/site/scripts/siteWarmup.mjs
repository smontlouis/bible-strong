// The pure parts of the cache warm-up (`warm-site-cache.mjs`): which pages to request, how
// fast, how to read an answer, and when to slow down or stop. Nothing here touches the
// network, the disk or the clock, so every rule is tested in
// `features/resources/siteWarmup.test.ts`.
import { parseArgs } from 'node:util'

/** The origin the sitemaps write their addresses with, whichever host serves them. */
export const SITE_ORIGIN = 'https://bible-strong.app'

// ---------------------------------------------------------------------------------------
// What a page costs
// ---------------------------------------------------------------------------------------

/**
 * The reads per minute the Resource API allows one caller address
 * (`packages/resource-service/README.md`, "Resource API rate limits"). The site renders from
 * few addresses, so the warm-up, the readers and the crawlers draw on the same allowance.
 */
export const API_READS_PER_MINUTE = 1000

/** The share of that allowance a warm-up takes when nothing else is asked. */
export const DEFAULT_READ_SHARE = 0.25
/** The share no `--rate` may exceed: readers and crawlers always keep a quarter. */
export const HIGHEST_READ_SHARE = 0.75

/** No default goes faster than one page a second, however cheap the pages are. */
export const HIGHEST_DEFAULT_RATE = 60
/** No run goes faster than this, whatever is asked. */
export const HIGHEST_RATE = 240

/**
 * The Resource API reads one uncached render makes, by the sitemap that lists the page.
 * Every read is taken to count against the allowance, answered from the API cache or not:
 * the safe side, whatever the limit ends up counting.
 */
const PAGE_READS = [
  { sitemaps: /^bible-.+-verses\.xml$/u, reads: 13 },
  { sitemaps: /^bible-(?!versions\.xml$).+\.xml$/u, reads: 3 },
  { sitemaps: /^strong-(?:hebrew|greek)\.xml$/u, reads: 6 },
]
/** A page of a kind nobody measured is taken to cost as much as the dearest one. */
const UNMEASURED_PAGE_READS = 13

/** @param {string} sitemap */
export const pageReadsFor = sitemap =>
  PAGE_READS.find(kind => kind.sitemaps.test(sitemap))?.reads ?? UNMEASURED_PAGE_READS

/**
 * The pages per minute a selection is requested at: the dearest page it holds must stay
 * within the given share of the allowance, as if every page were that one.
 *
 * @param {readonly string[]} sitemaps
 * @param {number} share
 */
const rateWithin = (sitemaps, share) =>
  Math.max(
    1,
    Math.floor((API_READS_PER_MINUTE * share) / Math.max(1, ...sitemaps.map(pageReadsFor)))
  )

/** @param {readonly string[]} sitemaps */
export const defaultRateFor = sitemaps =>
  Math.min(HIGHEST_DEFAULT_RATE, rateWithin(sitemaps, DEFAULT_READ_SHARE))

/** @param {readonly string[]} sitemaps */
export const highestRateFor = sitemaps =>
  Math.min(HIGHEST_RATE, rateWithin(sitemaps, HIGHEST_READ_SHARE))

/**
 * A sitemap is a render too, and some read much: a Strong sitemap walks the lexicon five
 * hundred entries at a time, a verse sitemap asks for the verses of every chapter. The
 * pause after one keeps the sitemaps within the default share as well.
 *
 * @param {string} sitemap
 */
export const sitemapPauseMs = sitemap => {
  const reads = /^(?:strong-(?:hebrew|greek)|bible-.+-verses)\.xml$/u.test(sitemap) ? 50 : 3
  return Math.max(1_000, Math.ceil((reads / (API_READS_PER_MINUTE * DEFAULT_READ_SHARE)) * 60_000))
}

// ---------------------------------------------------------------------------------------
// What to request
// ---------------------------------------------------------------------------------------

// The best-known Bibles of each language, as `MAIN_BIBLE_VERSIONS` names them in
// `features/bible/bibleVerseRules.ts`. A test keeps both lists alike.
const MAIN_BIBLES = ['lsg', 's21', 'bds', 'neg79', 'dby', 'kjv', 'niv', 'esv', 'nkjv', 'nlt']

/**
 * The sitemaps of the verse pages. `/sitemap.xml` does not list them
 * (`ANNOUNCE_BIBLE_VERSE_SITEMAPS`), so they are known here by name.
 */
export const VERSE_SITEMAPS = MAIN_BIBLES.map(bible => `bible-${bible}-verses.xml`)

/** A verse sitemap is never taken by a pattern: some 31,000 pages each, only when named. */
const NAMED_ONLY = /-verses\.xml$/u

/**
 * @typedef {object} Preset
 * @property {string} about
 * @property {readonly string[]} sitemaps Names, or patterns where `*` stands for anything.
 * @property {readonly string[]} [except] Sitemaps the patterns of this preset leave out.
 * @property {boolean} [lists] Keep only the entry pages and the lists of each sitemap.
 */

/** @type {Record<string, Preset>} */
export const PRESETS = {
  entry: {
    about: 'the entry page and the lists of every section',
    sitemaps: [
      'pages.xml',
      'bible-versions.xml',
      '*-index.xml',
      'dictionary-*.xml',
      'nave-*.xml',
      'commentary-*.xml',
      'timeline.xml',
    ],
    // The term sitemaps list no entry page and no list.
    except: ['dictionary-terms-*.xml'],
    lists: true,
  },
  chapters: {
    about: 'the chapters of the ten best-known Bibles, read as text',
    sitemaps: MAIN_BIBLES.map(bible => `bible-${bible}.xml`),
  },
  strong: {
    about: 'the entry page of every Strong number, in both languages',
    sitemaps: ['strong-hebrew.xml', 'strong-greek.xml'],
  },
  study: {
    about: 'dictionary articles and terms, topics, commentary chapters and timeline events',
    sitemaps: ['dictionary-*.xml', 'nave-*.xml', 'commentary-*.xml', 'timeline.xml'],
  },
  bibles: {
    about: 'the chapters of every Bible in every reading mode',
    sitemaps: ['bible-*.xml'],
    except: ['bible-versions.xml'],
  },
  all: {
    about: 'every page `/sitemap.xml` leads to, the verse pages left out',
    sitemaps: ['*'],
  },
  verses: {
    about: 'the verse pages of the ten best-known Bibles, about 31,000 each',
    sitemaps: VERSE_SITEMAPS,
  },
}

export const DEFAULT_PRESET = 'entry'

/**
 * @typedef {object} SitemapRule
 * @property {string} pattern
 * @property {boolean} lists
 * @property {readonly string[]} [except] Sitemaps this rule does not take.
 */

/** @param {string} pattern */
const patternToRegExp = pattern =>
  new RegExp(
    `^${pattern
      .split('*')
      .map(part => part.replace(/[\\^$.+?()[\]{}|]/gu, '\\$&'))
      .join('.*')}$`,
    'u'
  )

/** @param {string} name */
export const isSitemapName = name => /^[a-z0-9][a-z0-9.-]*\.xml$/u.test(name)

/**
 * The sitemaps a run reads, in the order it reads them: rule after rule, and within a rule
 * in the order of `/sitemap.xml`. A name written in full is taken as it is, listed or not;
 * a pattern only finds listed sitemaps, and never a verse sitemap. A sitemap two rules name
 * keeps all its pages unless both rules want its lists only.
 *
 * @param {readonly string[]} listed The names `/sitemap.xml` lists.
 * @param {readonly SitemapRule[]} rules
 * @param {readonly string[]} [exclude]
 * @returns {{ name: string, lists: boolean }[]}
 */
export const selectSitemaps = (listed, rules, exclude = []) => {
  const matches = (/** @type {readonly string[]} */ patterns, /** @type {string} */ name) =>
    patterns.some(pattern => patternToRegExp(pattern).test(name))
  /** @type {Map<string, boolean>} */
  const selected = new Map()
  for (const rule of rules) {
    const names = rule.pattern.includes('*')
      ? listed.filter(name => !NAMED_ONLY.test(name) && patternToRegExp(rule.pattern).test(name))
      : [rule.pattern]
    for (const name of names) {
      if (!isSitemapName(name) || matches(exclude, name) || matches(rule.except ?? [], name)) {
        continue
      }
      selected.set(name, (selected.get(name) ?? true) && rule.lists)
    }
  }
  return [...selected].map(([name, lists]) => ({ name, lists }))
}

// The entry pages and the lists of ADR-0068, by their path. A sitemap of resources opens
// with its lists (`nave-fr.xml`: the topics, their letters, then every topic), and nothing
// but the path tells them apart.
const LIST_PATHS = [
  /^\/(?:fr)?$/u,
  /^\/(?:fr\/)?bible$/u,
  /^\/bible\/[^/]+$/u,
  /^\/(?:strong|dictionary|nave|commentary|timeline)\/[^/]+$/u,
  /^\/strong\/[^/]+\/(?:hebrew|greek)\/[^/]+$/u,
  /^\/dictionary\/[^/]+\/(?!term\/)[^/]+(?:\/[^/]+)?$/u,
  /^\/nave\/[^/]+\/index\/[^/]+(?:\/\d+)?$/u,
  /^\/commentary\/[^/]+\/[^/]+$/u,
]

/** Whether a path is an entry page or a list, not the page of one resource. */
export const isListPath = (/** @type {string} */ pathname) =>
  LIST_PATHS.some(pattern => pattern.test(pathname))

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** @param {string} text */
const decodeXml = text =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, entity) => {
    if (entity[0] !== '#') return XML_ENTITIES[/** @type {'amp'} */ (entity)] ?? whole
    const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
    return String.fromCodePoint(code)
  })

/**
 * The addresses of a sitemap, or of a sitemap index: what its `<loc>` elements hold. The
 * language alternates of a page are attributes, and each is listed as an address as well.
 *
 * @param {string} xml
 * @returns {string[]}
 */
export const parseSitemapLocs = xml =>
  Array.from(xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/gu), match => decodeXml(match[1]))

/** Whether a document is a sitemap, or the index of sitemaps, and not an error page. */
export const isSitemapDocument = (/** @type {string} */ xml) =>
  /<(?:urlset|sitemapindex)[\s>]/u.test(xml)

/**
 * The names of the sitemaps an index lists. An address that is not `/sitemaps/:name` on
 * the site is left out: the tool only reads the sitemaps of the site.
 *
 * @param {string} xml
 * @param {string} origin The origin the run requests.
 */
export const parseSitemapIndex = (xml, origin) =>
  parseSitemapLocs(xml).flatMap(loc => {
    const url = parseUrl(loc)
    const name = url?.pathname.match(/^\/sitemaps\/([^/]+)$/u)?.[1]
    return url && name && isSitemapName(name) && isSiteOrigin(url.origin, origin) ? [name] : []
  })

/** @param {string} value */
const parseUrl = value => {
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

/**
 * @param {string} candidate
 * @param {string} origin
 */
const isSiteOrigin = (candidate, origin) => candidate === SITE_ORIGIN || candidate === origin

/**
 * The pages of one sitemap a run requests, as paths of the requested origin. A sitemap
 * writes every address with the public origin, wherever it is served from; an address of
 * another site is counted and never requested.
 *
 * @param {string} xml
 * @param {object} options
 * @param {string} options.origin The origin the run requests.
 * @param {boolean} [options.lists] Keep the entry pages and the lists only.
 * @param {number} [options.limit] At most this many pages of this sitemap.
 * @param {Set<string>} [options.seen] Paths already taken; the paths kept are added to it.
 * @returns {{ paths: string[], listed: number, foreign: number, repeated: number }}
 */
export const takePages = (xml, { origin, lists = false, limit = Infinity, seen = new Set() }) => {
  const locs = parseSitemapLocs(xml)
  const paths = []
  let foreign = 0
  let repeated = 0
  for (const loc of locs) {
    const url = parseUrl(loc)
    if (!url || !isSiteOrigin(url.origin, origin) || url.username || url.password) {
      foreign += 1
      continue
    }
    if (lists && !isListPath(url.pathname)) continue
    const path = `${url.pathname}${url.search}`
    if (seen.has(path)) {
      repeated += 1
      continue
    }
    if (paths.length >= limit) break
    seen.add(path)
    paths.push(path)
  }
  return { paths, listed: locs.length, foreign, repeated }
}

// ---------------------------------------------------------------------------------------
// The command line
// ---------------------------------------------------------------------------------------

export const DEFAULT_CONCURRENCY = 2
export const HIGHEST_CONCURRENCY = 6
/** One rendered page in this many is requested again to check the CDN kept it. */
export const DEFAULT_VERIFY_EVERY = 10

export const USAGE = `Requests pages of the public site so that the CDN and the Resource API hold them.

  node apps/site/scripts/warm-site-cache.mjs [options]

What to request
  --preset <name>       ${Object.keys(PRESETS).join(', ')}; several with commas (default: ${DEFAULT_PRESET})
  --sitemap <pattern>   a sitemap by name, or a pattern with * (repeatable). A verse sitemap
                        is only taken when named in full: --sitemap bible-lsg-verses.xml
  --exclude <pattern>   leave these sitemaps out (repeatable)
  --per-sitemap <n>     at most n pages of each sitemap
  --limit <n>           at most n pages in all
How to request it
  --rate <n>            pages per minute (default: from the dearest kind of page selected)
  --concurrency <n>     pages in flight at once (default: ${DEFAULT_CONCURRENCY}, at most ${HIGHEST_CONCURRENCY})
  --verify <n>          request again one rendered page in n, 75 s later, to check the CDN
                        kept it (default: ${DEFAULT_VERIFY_EVERY}; 0 never)
  --origin <url>        the site to request (default: ${SITE_ORIGIN})
Running
  --dry-run             read the sitemaps, list what would be requested and how long it takes
  --list                with --dry-run, print every address
  --resume              skip the pages the journal shows warm for less than a day
  --journal <file>      where the run is written (default: node_modules/.cache/site-warmup/)
  --help

Presets
${Object.entries(PRESETS)
  .map(([name, preset]) => `  ${name.padEnd(10)}${preset.about}`)
  .join('\n')}
`

/**
 * @typedef {object} WarmupOptions
 * @property {string} origin
 * @property {SitemapRule[]} rules
 * @property {string[]} exclude
 * @property {number} limit
 * @property {number} perSitemap
 * @property {number | undefined} rate
 * @property {number} concurrency
 * @property {number} verifyEvery
 * @property {boolean} dryRun
 * @property {boolean} list
 * @property {boolean} resume
 * @property {string | undefined} journal
 * @property {boolean} help
 */

/**
 * @param {string | undefined} value
 * @param {string} option
 * @param {{ min: number, max?: number, fallback: number }} bounds
 */
const wholeNumber = (value, option, { min, max = Number.MAX_SAFE_INTEGER, fallback }) => {
  if (value === undefined) return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    const range = max === Number.MAX_SAFE_INTEGER ? `${min} or more` : `from ${min} to ${max}`
    throw new Error(`--${option} takes a whole number, ${range}: ${value}`)
  }
  return number
}

/**
 * Reads the command line. An option the tool does not know, or a value it cannot use, is an
 * error: a warm-up never runs on a guess.
 *
 * @param {readonly string[]} argv
 * @returns {WarmupOptions}
 */
export const readOptions = argv => {
  const { values } = parseArgs({
    args: [...argv],
    strict: true,
    allowPositionals: false,
    options: {
      preset: { type: 'string', multiple: true },
      sitemap: { type: 'string', multiple: true },
      exclude: { type: 'string', multiple: true },
      'per-sitemap': { type: 'string' },
      limit: { type: 'string' },
      rate: { type: 'string' },
      concurrency: { type: 'string' },
      verify: { type: 'string' },
      origin: { type: 'string' },
      'dry-run': { type: 'boolean' },
      list: { type: 'boolean' },
      resume: { type: 'boolean' },
      journal: { type: 'string' },
      help: { type: 'boolean' },
    },
  })

  const named = (values.preset ?? []).flatMap(value => value.split(',')).filter(Boolean)
  const sitemaps = values.sitemap ?? []
  const presets = named.length || sitemaps.length ? named : [DEFAULT_PRESET]
  for (const name of presets) {
    if (!Object.hasOwn(PRESETS, name)) {
      throw new Error(`Unknown preset "${name}". Presets: ${Object.keys(PRESETS).join(', ')}`)
    }
  }
  for (const pattern of [...sitemaps, ...(values.exclude ?? [])]) {
    if (!/^[a-z0-9*][a-z0-9.*-]*$/u.test(pattern)) {
      throw new Error(`Not a sitemap name or pattern: ${pattern}`)
    }
  }

  const url = parseUrl(values.origin ?? SITE_ORIGIN)
  if (!url || !/^https?:$/u.test(url.protocol) || url.username || url.password) {
    throw new Error(`--origin takes the address of a site: ${values.origin}`)
  }

  return {
    origin: url.origin,
    rules: [
      ...presets.flatMap(name =>
        PRESETS[name].sitemaps.map(pattern => ({
          pattern,
          lists: PRESETS[name].lists ?? false,
          except: PRESETS[name].except,
        }))
      ),
      ...sitemaps.map(pattern => ({ pattern, lists: false })),
    ],
    exclude: values.exclude ?? [],
    limit: wholeNumber(values.limit, 'limit', { min: 1, fallback: Infinity }),
    perSitemap: wholeNumber(values['per-sitemap'], 'per-sitemap', { min: 1, fallback: Infinity }),
    rate:
      values.rate === undefined
        ? undefined
        : wholeNumber(values.rate, 'rate', { min: 1, max: HIGHEST_RATE, fallback: 1 }),
    concurrency: wholeNumber(values.concurrency, 'concurrency', {
      min: 1,
      max: HIGHEST_CONCURRENCY,
      fallback: DEFAULT_CONCURRENCY,
    }),
    verifyEvery: wholeNumber(values.verify, 'verify', { min: 0, fallback: DEFAULT_VERIFY_EVERY }),
    dryRun: values['dry-run'] ?? false,
    list: values.list ?? false,
    resume: values.resume ?? false,
    journal: values.journal,
    help: values.help ?? false,
  }
}

/**
 * The rate of a run: the one asked, refused when the dearest page selected would take more
 * than three quarters of the allowance at that rate, or the default of the selection.
 *
 * @param {number | undefined} asked
 * @param {readonly string[]} sitemaps
 */
export const resolveRate = (asked, sitemaps) => {
  if (asked === undefined) return defaultRateFor(sitemaps)
  const highest = highestRateFor(sitemaps)
  if (asked > highest) {
    const reads = Math.max(1, ...sitemaps.map(pageReadsFor))
    throw new Error(
      `--rate ${asked} is too fast for this selection: a page may make ${reads} Resource API ` +
        `reads, and ${highest} pages a minute already take ${HIGHEST_READ_SHARE * 100}% of the ` +
        `${API_READS_PER_MINUTE} reads a minute the API allows the site.`
    )
  }
  return asked
}

/**
 * How long a run takes when nothing goes wrong: one request per page at the chosen rate,
 * the pages requested a second time to check the CDN kept them, and the wait before the
 * last of those. A pause after trouble, or a site slower than the rate, makes it longer.
 *
 * @param {object} plan
 * @param {number} plan.pages
 * @param {number} plan.rate
 * @param {number} [plan.verifyEvery]
 */
export const estimateRunMs = ({ pages, rate, verifyEvery = 0 }) => {
  if (!pages) return 0
  const checks = verifyEvery > 0 ? Math.ceil(pages / verifyEvery) : 0
  return Math.ceil(((pages + checks) / rate) * 60_000) + (checks ? VERIFY_DELAY_MS : 0)
}

/** @param {number} ms */
export const formatDuration = ms => {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`
  return `${Math.floor(hours / 24)} d ${hours % 24} h`
}

// ---------------------------------------------------------------------------------------
// Reading an answer
// ---------------------------------------------------------------------------------------

/**
 * How long the CDN keeps a page missing a part (`INCOMPLETE_PAGE_CACHE_CONTROL`), and how
 * long after a render a page is requested again: by then a page kept a minute has gone.
 */
export const INCOMPLETE_PAGE_SECONDS = 60
export const VERIFY_DELAY_MS = 75_000

/**
 * Whether the CDN is expected to keep a page it rendered whole. The landing page of each
 * language is not a resource page: it sends no `s-maxage` and is rendered for every reader,
 * so finding it rendered again a minute later says nothing.
 *
 * @param {string} path
 */
export const isKeptWhenWhole = path => !/^\/(?:fr)?(?:\?|$)/u.test(path)

/**
 * @typedef {'cached' | 'stale' | 'rendered' | 'limited' | 'failed' | 'refused' | 'missing' | 'redirected'} AnswerKind
 * @typedef {'whole' | 'incomplete' | 'provisional' | 'unknown'} Completeness
 *
 * @typedef {object} Answer
 * @property {AnswerKind} kind
 * @property {Completeness} completeness
 * @property {string} [cache] What `x-vercel-cache` said.
 * @property {number} [retryAfterMs]
 */

/**
 * Reads what the site answered a page request.
 *
 * - `cached`: the CDN held the page; nothing was rendered. `stale`: it held an old copy,
 *   served it, and renders a new one behind the answer.
 * - `rendered`: the site rendered the page for this request, and the Resource API was read.
 * - `limited` (429), `failed` (5xx, or no answer: status 0) and `refused` (401, 403) mean
 *   the site is in trouble or wants no warm-up; `missing` and `redirected` mean the sitemap
 *   lists an address that is not a page.
 *
 * A page rendered from an answer an earlier version of the Resource API had cached says so
 * with `X-Page-Stale`: it is whole, the site keeps it a minute, and the API has refreshed
 * its answers by the time it is rendered again. That is `provisional`, and not trouble.
 *
 * A page the site could not render whole says so with `X-Page-Incomplete`. Where the CDN
 * lets `s-maxage` through (a development server), a page kept less than an hour is
 * incomplete too. Without either, a rendered page is `unknown`: Vercel answers every page
 * with the same `Cache-Control`, and only a second request tells whether it was kept.
 *
 * @param {object} response
 * @param {number} response.status
 * @param {Record<string, string | undefined>} [response.headers] Lower-case names.
 * @returns {Answer}
 */
export const readAnswer = ({ status, headers = {} }) => {
  const cache = headers['x-vercel-cache']?.toUpperCase()
  if (status === 429) {
    return { kind: 'limited', completeness: 'unknown', cache, retryAfterMs: retryAfterMs(headers) }
  }
  if (status === 0 || status >= 500) {
    return { kind: 'failed', completeness: 'unknown', cache, retryAfterMs: retryAfterMs(headers) }
  }
  if (status === 401 || status === 403) return { kind: 'refused', completeness: 'unknown', cache }
  if (status >= 300 && status < 400) return { kind: 'redirected', completeness: 'unknown', cache }
  if (status !== 200) return { kind: 'missing', completeness: 'unknown', cache }

  const kind =
    cache === 'HIT' || cache === 'PRERENDER' ? 'cached' : cache === 'STALE' ? 'stale' : 'rendered'
  return { kind, completeness: completenessOf(kind, headers), cache }
}

/**
 * @param {AnswerKind} kind
 * @param {Record<string, string | undefined>} headers
 * @returns {Completeness}
 */
const completenessOf = (kind, headers) => {
  const flag = headers['x-page-incomplete']?.trim()
  if (flag && flag !== '0') return 'incomplete'
  const stale = headers['x-page-stale']?.trim()
  if (stale && stale !== '0') return 'provisional'
  const kept = headers['cache-control']?.match(/(?:^|[\s,])s-maxage=(\d+)/iu)?.[1]
  if (kept !== undefined) return Number(kept) < 3600 ? 'incomplete' : 'whole'
  // An incomplete page is never served stale, and never kept more than a minute.
  if (kind === 'stale') return 'whole'
  if (kind === 'cached' && Number(headers.age) > INCOMPLETE_PAGE_SECONDS) return 'whole'
  return 'unknown'
}

const HIGHEST_RETRY_AFTER_MS = 15 * 60_000

/**
 * What `Retry-After` asks for, in seconds: the form the Resource API and Vercel use. A date
 * is not read; the pause of the run applies then.
 *
 * @param {Record<string, string | undefined>} headers
 */
const retryAfterMs = headers => {
  const seconds = Number(headers['retry-after'])
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, HIGHEST_RETRY_AFTER_MS)
    : undefined
}

// ---------------------------------------------------------------------------------------
// When to slow down, and when to stop
// ---------------------------------------------------------------------------------------

/** A run pauses this many times at most; the next trouble stops it. */
export const HIGHEST_PAUSES = 3
const FIRST_PAUSE_MS = 60_000
/** After this many good answers in a row, one pause is forgiven. */
const ANSWERS_TO_FORGIVE_A_PAUSE = 100
/** After this many, trouble with a page requested again is the trouble of that page. */
const ANSWERS_THAT_CLEAR_THE_SITE = 10
/** This many addresses in a row that are not pages: the sitemaps and the site disagree. */
const HIGHEST_MISSES_IN_A_ROW = 20
/** An address in trouble is requested once more, and not before this long. */
export const RETRY_DELAY_MS = 90_000

/**
 * @typedef {object} Pace
 * @property {number} rate Pages per minute, halved at every pause.
 * @property {number} ceiling The rate a run may come back to: lowered for good when the
 *   site said it was being asked too much.
 * @property {number} era How many pauses the run has taken: a request carries the era it
 *   was sent in, so the answers of one bad minute are one trouble, not several.
 * @property {number} pauses Pauses not yet forgiven.
 * @property {number} good Good answers in a row.
 * @property {number} misses Addresses in a row that were not pages.
 *
 * @typedef {'limited' | 'failed' | 'refused' | 'incomplete' | 'missing' | 'good'} Signal
 *
 * @typedef {object} Verdict
 * @property {Pace} pace
 * @property {number} [pauseMs] Request nothing for this long, then go on at `pace.rate`.
 * @property {string} [stop] Why the run ends here.
 */

/** @param {number} rate @returns {Pace} */
export const startPace = rate => ({ rate, ceiling: rate, era: 0, pauses: 0, good: 0, misses: 0 })

/**
 * What an answer means for the run.
 *
 * @param {Pick<Answer, 'kind' | 'completeness'>} answer
 * @returns {Signal}
 */
export const signalOf = answer => {
  if (answer.kind === 'limited' || answer.kind === 'failed' || answer.kind === 'refused') {
    return answer.kind
  }
  if (answer.kind === 'missing' || answer.kind === 'redirected') return 'missing'
  return answer.completeness === 'incomplete' ? 'incomplete' : 'good'
}

const TROUBLE = {
  limited: 'the site answered 429: it is limiting requests',
  failed: 'the site answered an error, or did not answer',
  incomplete: 'a page came back incomplete: the Resource API is refusing or failing reads',
}

/**
 * Decides what a run does after an answer.
 *
 * Trouble (429, an error, an incomplete page) pauses the whole run for one minute, then
 * two, then four, or for what `Retry-After` asks when that is longer, and halves the rate
 * each time. Trouble after the third pause stops the run; a refusal stops it at once.
 *
 * A hundred good answers in a row forgive one pause. They give the rate back only after
 * an error: a 429 or an incomplete page say the site was asked too much, and the run never
 * returns to a rate that got that answer.
 *
 * A page requested again that fails again while the pages around it answer well has a
 * trouble of its own: it is reported, and the run goes on.
 *
 * @param {Pace} pace
 * @param {object} event
 * @param {Signal} event.signal
 * @param {number} event.era The era of the request the answer is for.
 * @param {number} [event.retryAfterMs]
 * @param {boolean} [event.again] The page was requested before, and was in trouble then.
 * @returns {Verdict}
 */
export const judge = (pace, { signal, era, retryAfterMs: asked = 0, again = false }) => {
  if (signal === 'good') {
    const good = pace.good + 1
    return good >= ANSWERS_TO_FORGIVE_A_PAUSE && pace.pauses > 0
      ? {
          pace: {
            ...pace,
            rate: Math.min(pace.ceiling, pace.rate * 2),
            pauses: pace.pauses - 1,
            good: 0,
            misses: 0,
          },
        }
      : { pace: { ...pace, good, misses: 0 } }
  }
  if (signal === 'refused') {
    return { pace, stop: 'the site refused the request (401 or 403): it wants no warm-up' }
  }
  if (signal === 'missing') {
    const misses = pace.misses + 1
    return misses >= HIGHEST_MISSES_IN_A_ROW
      ? {
          pace: { ...pace, misses },
          stop: `${misses} addresses in a row are not pages: the sitemaps and the site disagree`,
        }
      : { pace: { ...pace, misses } }
  }
  if (again && signal !== 'limited' && pace.good >= ANSWERS_THAT_CLEAR_THE_SITE) return { pace }
  // The answer to a request sent before the last pause: that minute is already paid for.
  if (era < pace.era) return { pace: { ...pace, good: 0 } }
  if (pace.pauses >= HIGHEST_PAUSES) {
    return { pace: { ...pace, good: 0 }, stop: `${TROUBLE[signal]}, after ${pace.pauses} pauses` }
  }
  const rate = Math.max(1, Math.floor(pace.rate / 2))
  return {
    pace: {
      rate,
      ceiling: signal === 'failed' ? pace.ceiling : Math.min(pace.ceiling, rate),
      era: pace.era + 1,
      pauses: pace.pauses + 1,
      good: 0,
      misses: pace.misses,
    },
    pauseMs: Math.max(asked, FIRST_PAUSE_MS * 2 ** pace.pauses),
  }
}

/** @param {'limited' | 'failed' | 'incomplete'} signal */
export const describeTrouble = signal => TROUBLE[signal]

// ---------------------------------------------------------------------------------------
// The journal and the report
// ---------------------------------------------------------------------------------------

/**
 * @typedef {object} PageRecord One request of a page, as the journal keeps it.
 * @property {string} path
 * @property {string} at ISO date of the answer.
 * @property {AnswerKind} kind
 * @property {Completeness} completeness
 * @property {number} status
 * @property {number} ms
 * @property {string} [cache]
 * @property {'first' | 'retry' | 'verify' | 'settle'} pass
 * @property {string} [sitemap]
 */

/** How long the journal vouches for a page: what the CDN keeps it for. */
export const WARM_FOR_MS = 24 * 60 * 60_000

/** @param {Pick<PageRecord, 'kind' | 'completeness'>} record */
export const isWarm = ({ kind, completeness }) =>
  (kind === 'cached' || kind === 'stale' || kind === 'rendered') &&
  completeness !== 'incomplete' &&
  // A provisional page is kept a minute: it is warm once it has been rendered again.
  completeness !== 'provisional'

/**
 * The pages a resumed run skips: those whose last answer in the journal was a page, whole
 * as far as could be told, less than a day ago. A line that is not a record is ignored: a
 * run that was killed may have left its last line cut.
 *
 * @param {string} journal The journal, one JSON record per line.
 * @param {number} now
 * @returns {Set<string>}
 */
export const warmPaths = (journal, now) => {
  /** @type {Map<string, boolean>} */
  const last = new Map()
  for (const line of journal.split('\n')) {
    if (!line.startsWith('{"path"')) continue
    try {
      /** @type {PageRecord} */
      const record = JSON.parse(line)
      const age = now - Date.parse(record.at)
      last.set(record.path, isWarm(record) && age >= 0 && age < WARM_FOR_MS)
    } catch {
      // A cut line.
    }
  }
  return new Set([...last].filter(([, warm]) => warm).map(([path]) => path))
}

/**
 * @param {readonly number[]} sorted Ascending.
 * @param {number} fraction
 */
const percentile = (sorted, fraction) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]

/**
 * How long answers took: the fastest, the median, nine in ten, ninety-nine in a hundred
 * and the slowest, in milliseconds.
 *
 * @param {readonly number[]} times
 */
export const timeDistribution = times => {
  if (!times.length) return undefined
  const sorted = [...times].sort((a, b) => a - b)
  return {
    count: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1],
  }
}

/**
 * What a run did, from its records. A page is counted once, by its first answer: what the
 * run found. Retries and checks are counted apart, by what they showed.
 *
 * @param {readonly PageRecord[]} records
 */
export const summarize = records => {
  const first = records.filter(record => record.pass === 'first')
  const count = (/** @type {(record: PageRecord) => boolean} */ test) => first.filter(test).length
  const times = (/** @type {AnswerKind} */ kind) =>
    timeDistribution(first.filter(record => record.kind === kind).map(record => record.ms))
  const verified = records.filter(record => record.pass === 'verify')
  const retried = records.filter(record => record.pass === 'retry')
  return {
    requests: records.length,
    pages: first.length,
    cached: count(record => record.kind === 'cached'),
    stale: count(record => record.kind === 'stale'),
    rendered: count(record => record.kind === 'rendered'),
    incomplete: count(record => isPage(record) && record.completeness === 'incomplete'),
    provisional: count(record => isPage(record) && record.completeness === 'provisional'),
    limited: count(record => record.kind === 'limited'),
    failed: count(record => record.kind === 'failed'),
    refused: count(record => record.kind === 'refused'),
    missing: count(record => record.kind === 'missing'),
    redirected: count(record => record.kind === 'redirected'),
    retried: retried.length,
    recovered: retried.filter(isWarm).length,
    verified: verified.length,
    kept: verified.filter(record => record.kind === 'cached' || record.kind === 'stale').length,
    times: { cached: times('cached'), stale: times('stale'), rendered: times('rendered') },
  }
}

/** @param {PageRecord} record */
const isPage = record =>
  record.kind === 'cached' || record.kind === 'stale' || record.kind === 'rendered'

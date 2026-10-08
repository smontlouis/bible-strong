import { describe, expect, it } from 'vitest'
import { BIBLE_VERSE_SITEMAPS } from '../bible/bibleVerseSitemap'
import { pageCacheHeaders } from './pageReads'
import { renderSitemap, renderSitemapIndex } from './sitemap'
import { listAnnouncedSitemaps, SITEMAPS } from './sitemapRegistry'
import {
  defaultRateFor,
  estimateRunMs,
  formatDuration,
  highestRateFor,
  isKeptWhenWhole,
  isListPath,
  isSitemapDocument,
  judge,
  parseSitemapIndex,
  parseSitemapLocs,
  PRESETS,
  isWarm,
  readAnswer,
  readOptions,
  resolveRate,
  selectSitemaps,
  signalOf,
  sitemapPauseMs,
  startPace,
  summarize,
  takePages,
  timeDistribution,
  VERSE_SITEMAPS,
  warmPaths,
  type Pace,
  type PageRecord,
  type Signal,
} from '../../scripts/siteWarmup.mjs'

// The warm-up script (`scripts/warm-site-cache.mjs`) is tested here, where the tests of the
// site run, against the sitemaps the site really serves.

const ORIGIN = 'https://bible-strong.app'
const LISTED = listAnnouncedSitemaps(false)
const rulesOf = (...presets: string[]) => readOptions(['--preset', presets.join(',')])
const namesOf = (...presets: string[]) => {
  const { rules, exclude } = rulesOf(...presets)
  return selectSitemaps(LISTED, rules, exclude).map(sitemap => sitemap.name)
}

describe('warm-up selection', () => {
  it('knows the verse sitemaps the site serves, which no index lists', () => {
    expect([...VERSE_SITEMAPS].sort()).toEqual(Object.keys(BIBLE_VERSE_SITEMAPS).sort())
  })

  it('finds a served sitemap behind every name and pattern of a preset', () => {
    const served = Object.keys(SITEMAPS)
    for (const [name, preset] of Object.entries(PRESETS)) {
      for (const pattern of preset.sitemaps) {
        const found = selectSitemaps(served, [{ pattern, lists: false }])
        expect(found.length, `${name}: ${pattern}`).toBeGreaterThan(0)
        for (const sitemap of found) expect(served, `${name}: ${pattern}`).toContain(sitemap.name)
      }
    }
  })

  it('warms the entry pages and the lists when nothing is asked', () => {
    const options = readOptions([])

    expect(options.rules).toEqual(rulesOf('entry').rules)
    expect(options.rules.every(rule => rule.lists)).toBe(true)
    expect(namesOf('entry')).toEqual(
      expect.arrayContaining(['pages.xml', 'bible-versions.xml', 'strong-index.xml', 'nave-fr.xml'])
    )
    expect(namesOf('entry')).not.toContain('bible-lsg.xml')
    // A sitemap of resources without a list in it is not read for nothing.
    expect(namesOf('entry')).not.toContain('dictionary-terms-fr.xml')
    expect(namesOf('entry')).not.toContain('strong-hebrew.xml')
  })

  it('takes the chapters of the Bibles that have a verse sitemap', () => {
    expect(namesOf('chapters')).toEqual(
      VERSE_SITEMAPS.map(name => name.replace('-verses.xml', '.xml'))
    )
  })

  it('never takes a verse sitemap unless it is named', () => {
    // As if the verse sitemaps were announced: a pattern still leaves them out.
    const announced = Object.keys(SITEMAPS)
    for (const preset of Object.keys(PRESETS).filter(name => name !== 'verses')) {
      const { rules, exclude } = rulesOf(preset)
      const names = selectSitemaps(announced, rules, exclude).map(sitemap => sitemap.name)
      expect(
        names.filter(name => name.endsWith('-verses.xml')),
        preset
      ).toEqual([])
    }
    const pattern = selectSitemaps(announced, [{ pattern: 'bible-*-verses.xml', lists: false }])
    expect(pattern).toEqual([])
  })

  it('takes a verse sitemap by its name, listed or not', () => {
    const { rules } = readOptions(['--sitemap', 'bible-lsg-verses.xml'])

    expect(selectSitemaps(LISTED, rules)).toEqual([{ name: 'bible-lsg-verses.xml', lists: false }])
    expect(namesOf('verses')).toEqual(VERSE_SITEMAPS)
  })

  it('takes every listed sitemap with `all`, and every Bible chapter with `bibles`', () => {
    expect(namesOf('all')).toEqual(LISTED)
    expect(namesOf('bibles')).toEqual(
      LISTED.filter(name => name.startsWith('bible-') && name !== 'bible-versions.xml')
    )
  })

  it('reads the sitemaps rule after rule, each once', () => {
    const selected = selectSitemaps(
      ['pages.xml', 'nave-en.xml', 'nave-fr.xml', 'timeline.xml'],
      [
        { pattern: 'timeline.xml', lists: false },
        { pattern: 'nave-*.xml', lists: true },
        { pattern: '*', lists: true },
      ],
      ['pages.*']
    )

    expect(selected).toEqual([
      { name: 'timeline.xml', lists: false },
      { name: 'nave-en.xml', lists: true },
      { name: 'nave-fr.xml', lists: true },
    ])
  })

  it('keeps every page of a sitemap one preset wants whole', () => {
    const { rules, exclude } = rulesOf('entry', 'study')
    const selected = selectSitemaps(LISTED, rules, exclude)

    expect(selected.find(sitemap => sitemap.name === 'nave-fr.xml')?.lists).toBe(false)
    expect(selected.find(sitemap => sitemap.name === 'pages.xml')?.lists).toBe(true)
  })

  it('leaves out of a preset what that preset excepts, and nothing of another', () => {
    expect(namesOf('bibles')).not.toContain('bible-versions.xml')
    expect(namesOf('entry', 'bibles')).toContain('bible-versions.xml')
    expect(namesOf('entry', 'study')).toContain('dictionary-terms-fr.xml')

    const { rules, exclude } = readOptions(['--preset', 'entry,bibles', '--exclude', 'bible-v*'])
    const names = selectSitemaps(LISTED, rules, exclude).map(sitemap => sitemap.name)
    expect(names).not.toContain('bible-versions.xml')
    expect(names).not.toContain('bible-vul.xml')
    expect(names).toContain('bible-lsg.xml')
  })

  it('treats a pattern as text, not as an expression', () => {
    const selected = selectSitemaps(
      ['pages.xml', 'pagesxxml'],
      [{ pattern: 'pages.*', lists: false }]
    )

    expect(selected.map(sitemap => sitemap.name)).toEqual(['pages.xml'])
  })

  it('tells the entry pages and the lists from the pages of a resource', () => {
    const lists = [
      '/',
      '/fr',
      '/bible',
      '/fr/bible',
      '/bible/lsg',
      '/strong/fr',
      '/strong/en/greek/a',
      '/dictionary/fr',
      '/dictionary/fr/bost',
      '/dictionary/fr/bost/a',
      '/nave/en',
      '/nave/fr/index/a',
      '/nave/fr/index/a/2',
      '/commentary/fr',
      '/commentary/fr/barnes',
      '/timeline/fr',
    ]
    const resources = [
      '/bible/lsg/gen/1',
      '/bible/lsg/strong/gen/1',
      '/bible/lsg/gen/1/3',
      '/strong/fr/h0430',
      '/strong/fr/h0430/concordance',
      '/dictionary/fr/bost/378/beth-lebaoth',
      '/dictionary/fr/term/aaron',
      '/nave/fr/becher',
      '/commentary/fr/barnes/gen/1',
      '/timeline/fr/creation',
    ]

    expect(lists.filter(path => !isListPath(path))).toEqual([])
    expect(resources.filter(isListPath)).toEqual([])
  })
})

describe('warm-up sitemap reading', () => {
  const sitemap = renderSitemap([
    { loc: `${ORIGIN}/nave/fr`, alternates: [{ hrefLang: 'en', href: `${ORIGIN}/nave/en` }] },
    { loc: `${ORIGIN}/nave/fr/index/a` },
    { loc: `${ORIGIN}/dictionary/fr/bost/a?page=2&sort=<x>` },
    { loc: `${ORIGIN}/nave/fr/patriarchal%20government` },
    { loc: 'https://elsewhere.example/nave/fr/abel' },
    { loc: `${ORIGIN}/nave/fr/index/a` },
  ])

  it('reads the addresses the site writes, and not the alternates of a page', () => {
    expect(parseSitemapLocs(sitemap)).toEqual([
      `${ORIGIN}/nave/fr`,
      `${ORIGIN}/nave/fr/index/a`,
      `${ORIGIN}/dictionary/fr/bost/a?page=2&sort=<x>`,
      `${ORIGIN}/nave/fr/patriarchal%20government`,
      'https://elsewhere.example/nave/fr/abel',
      `${ORIGIN}/nave/fr/index/a`,
    ])
    expect(isSitemapDocument(sitemap)).toBe(true)
    expect(isSitemapDocument('<!doctype html><html><body>Not found</body></html>')).toBe(false)
  })

  it('reads the names of the sitemaps of the index, and only of the site', () => {
    const index = renderSitemapIndex([
      `${ORIGIN}/sitemaps/pages.xml`,
      `${ORIGIN}/sitemaps/bible-lsg.xml`,
      'https://elsewhere.example/sitemaps/pages.xml',
      `${ORIGIN}/sitemaps/../secret.xml`,
      `${ORIGIN}/other/pages.xml`,
    ])

    expect(isSitemapDocument(index)).toBe(true)
    expect(parseSitemapIndex(index, 'http://localhost:3210')).toEqual([
      'pages.xml',
      'bible-lsg.xml',
    ])
  })

  it('requests the pages on the chosen origin, and none of another site', () => {
    const taken = takePages(sitemap, { origin: 'http://localhost:3210' })

    expect(taken).toEqual({
      paths: [
        '/nave/fr',
        '/nave/fr/index/a',
        '/dictionary/fr/bost/a?page=2&sort=%3Cx%3E',
        '/nave/fr/patriarchal%20government',
      ],
      listed: 6,
      foreign: 1,
      repeated: 1,
    })
  })

  it('keeps the lists only, up to a limit, without a page another sitemap gave', () => {
    const seen = new Set(['/nave/fr'])
    const lists = takePages(sitemap, { origin: ORIGIN, lists: true, seen })

    expect(lists.paths).toEqual(['/nave/fr/index/a', '/dictionary/fr/bost/a?page=2&sort=%3Cx%3E'])
    expect(seen.has('/nave/fr/index/a')).toBe(true)
    expect(takePages(sitemap, { origin: ORIGIN, limit: 2 }).paths).toEqual([
      '/nave/fr',
      '/nave/fr/index/a',
    ])
  })
})

describe('warm-up options', () => {
  it('reads what is asked', () => {
    const options = readOptions([
      '--preset=chapters,strong',
      '--sitemap',
      'bible-lsg-verses.xml',
      '--exclude',
      'bible-nlt.xml',
      '--limit',
      '500',
      '--per-sitemap=50',
      '--rate',
      '30',
      '--concurrency',
      '3',
      '--verify',
      '0',
      '--origin',
      'http://localhost:3210/fr/bible',
      '--resume',
      '--dry-run',
    ])

    expect(options).toMatchObject({
      origin: 'http://localhost:3210',
      exclude: ['bible-nlt.xml'],
      limit: 500,
      perSitemap: 50,
      rate: 30,
      concurrency: 3,
      verifyEvery: 0,
      resume: true,
      dryRun: true,
    })
    expect(options.rules.at(-1)).toEqual({ pattern: 'bible-lsg-verses.xml', lists: false })
    expect(options.rules).toContainEqual({
      pattern: 'strong-greek.xml',
      lists: false,
      except: undefined,
    })
  })

  it('takes the named sitemaps alone when no preset is named', () => {
    expect(readOptions(['--sitemap', 'timeline.xml']).rules).toEqual([
      { pattern: 'timeline.xml', lists: false },
    ])
  })

  it('refuses what it does not understand instead of guessing', () => {
    const refused = [
      ['--preset', 'everything'],
      ['--rate', '0'],
      ['--rate', '241'],
      ['--rate', 'fast'],
      ['--concurrency', '7'],
      ['--limit', '-1'],
      ['--sitemap', '../../etc/passwd'],
      ['--origin', 'ftp://bible-strong.app'],
      ['--origin', 'https://user:secret@bible-strong.app'],
      ['--method', 'POST'],
      ['https://bible-strong.app/bible'],
    ]

    for (const argv of refused) expect(() => readOptions(argv), argv.join(' ')).toThrow()
  })
})

describe('warm-up rate', () => {
  it('keeps the dearest page selected within a quarter of what the API allows the site', () => {
    // 1,000 reads a minute: 250 for the warm-up, at 13 reads a verse page, 6 a Strong page
    // and 3 a chapter.
    expect(defaultRateFor(['bible-lsg-verses.xml'])).toBe(19)
    expect(defaultRateFor(['strong-hebrew.xml', 'strong-greek.xml'])).toBe(41)
    expect(defaultRateFor(['bible-lsg.xml', 'bible-kjv-strong.xml'])).toBe(60)
    expect(defaultRateFor(['bible-lsg.xml', 'strong-greek.xml'])).toBe(41)
    expect(defaultRateFor(['bible-lsg.xml', 'bible-lsg-verses.xml'])).toBe(19)
  })

  it('takes a page nobody measured for the dearest', () => {
    expect(defaultRateFor(['bible-versions.xml'])).toBe(19)
    expect(defaultRateFor(['nave-fr.xml', 'bible-lsg.xml'])).toBe(19)
    expect(defaultRateFor(namesOf('all'))).toBe(19)
  })

  it('never lets a run take more than three quarters of the allowance', () => {
    expect(highestRateFor(['bible-lsg-verses.xml'])).toBe(57)
    expect(highestRateFor(['strong-hebrew.xml'])).toBe(125)
    expect(highestRateFor(['bible-lsg.xml'])).toBe(240)

    expect(resolveRate(undefined, ['bible-lsg-verses.xml'])).toBe(19)
    expect(resolveRate(57, ['bible-lsg-verses.xml'])).toBe(57)
    expect(() => resolveRate(58, ['bible-lsg-verses.xml'])).toThrow(/too fast/u)
    expect(resolveRate(120, ['bible-lsg.xml'])).toBe(120)
  })

  it('pauses longer after a sitemap that reads much', () => {
    expect(sitemapPauseMs('bible-lsg.xml')).toBe(1_000)
    expect(sitemapPauseMs('strong-hebrew.xml')).toBe(12_000)
    expect(sitemapPauseMs('bible-lsg-verses.xml')).toBe(12_000)
  })

  it('says how long a run takes when nothing goes wrong', () => {
    expect(estimateRunMs({ pages: 1189, rate: 60 })).toBe(1_189_000)
    // One page in ten may be requested twice, the last of them 75 s after it was rendered.
    expect(estimateRunMs({ pages: 1189, rate: 60, verifyEvery: 10 })).toBe(1_308_000 + 75_000)
    expect(estimateRunMs({ pages: 0, rate: 19, verifyEvery: 10 })).toBe(0)

    expect(formatDuration(42_000)).toBe('42 s')
    expect(formatDuration(1_308_000)).toBe('22 min')
    expect(formatDuration(3 * 3_600_000 + 18 * 60_000)).toBe('3 h 18 min')
    expect(formatDuration(6 * 86_400_000 + 5 * 3_600_000)).toBe('6 d 5 h')
  })
})

describe('warm-up answers', () => {
  const page = (headers: Record<string, string>, status = 200) => readAnswer({ status, headers })

  it('tells a page the CDN held from a page the site rendered', () => {
    expect(page({ 'x-vercel-cache': 'HIT', age: '4000' })).toMatchObject({ kind: 'cached' })
    expect(page({ 'x-vercel-cache': 'STALE' })).toMatchObject({ kind: 'stale' })
    expect(page({ 'x-vercel-cache': 'MISS', age: '0' })).toMatchObject({ kind: 'rendered' })
    expect(page({ 'x-vercel-cache': 'REVALIDATED' })).toMatchObject({ kind: 'rendered' })
    // A development server has no CDN: every answer is a render.
    expect(page({})).toMatchObject({ kind: 'rendered', completeness: 'unknown' })
  })

  it('reads the trouble of the site in its status', () => {
    expect(page({ 'retry-after': '120' }, 429)).toMatchObject({
      kind: 'limited',
      retryAfterMs: 120_000,
    })
    expect(page({ 'retry-after': '86400' }, 429).retryAfterMs).toBe(900_000)
    expect(page({ 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }, 503)).toMatchObject({
      kind: 'failed',
      retryAfterMs: undefined,
    })
    expect(page({}, 0).kind).toBe('failed')
    expect(page({}, 403).kind).toBe('refused')
    expect(page({}, 404).kind).toBe('missing')
    expect(page({}, 308).kind).toBe('redirected')
  })

  // The headers of a page as a client reads them: names in lower case.
  const sentWith = (rendered: { incomplete?: boolean }) =>
    Object.fromEntries(
      Object.entries(pageCacheHeaders(rendered) ?? {}).map(([name, value]) => [
        name.toLowerCase(),
        value,
      ])
    )
  // What is left of them behind the CDN, which answers every page with one `Cache-Control`.
  const behindCdn = (headers: Record<string, string>, cache: string) => ({
    ...headers,
    'cache-control': 'public, max-age=0',
    'x-vercel-cache': cache,
  })

  it('knows an incomplete page by the header the site sends with it', () => {
    const rendered = page(behindCdn(sentWith({ incomplete: true }), 'MISS'))
    // The CDN keeps such a page a minute, header included.
    const cached = page(behindCdn(sentWith({ incomplete: true }), 'HIT'))

    expect(rendered).toMatchObject({ kind: 'rendered', completeness: 'incomplete' })
    expect(cached).toMatchObject({ kind: 'cached', completeness: 'incomplete' })
    expect(signalOf(rendered)).toBe('incomplete')
    expect(signalOf(cached)).toBe('incomplete')
    expect(page(behindCdn(sentWith({}), 'MISS')).completeness).toBe('unknown')
  })

  it('knows an incomplete page by how long it is kept, where no CDN hides it', () => {
    expect(page({ 'cache-control': 'public, max-age=0, s-maxage=60' }).completeness).toBe(
      'incomplete'
    )
    expect(page(sentWith({})).completeness).toBe('whole')
  })

  it('does not call a page whole on the word of the CDN alone', () => {
    // What Vercel answers for every page, whole or not.
    const hidden = { 'cache-control': 'public, max-age=0' }

    expect(page({ ...hidden, 'x-vercel-cache': 'MISS', age: '0' }).completeness).toBe('unknown')
    expect(page({ ...hidden, 'x-vercel-cache': 'HIT', age: '12' }).completeness).toBe('unknown')
    // Kept longer than an incomplete page ever is.
    expect(page({ ...hidden, 'x-vercel-cache': 'HIT', age: '61' }).completeness).toBe('whole')
    expect(page({ ...hidden, 'x-vercel-cache': 'STALE' }).completeness).toBe('whole')
  })

  it('takes a page rendered from an earlier answer of the API for provisional, not for trouble', () => {
    const provisional = page({
      'x-page-stale': '1',
      'cache-control': 'public, max-age=0, s-maxage=60',
      'x-vercel-cache': 'MISS',
    })

    expect(provisional).toMatchObject({ kind: 'rendered', completeness: 'provisional' })
    expect(signalOf(provisional)).toBe('good')
    // It is kept a minute: the journal does not vouch for it until it is rendered again.
    expect(isWarm(provisional)).toBe(false)
    // A page that is both says the worse of the two.
    expect(page({ 'x-page-stale': '1', 'x-page-incomplete': '1' }).completeness).toBe('incomplete')
  })

  it('expects the CDN to keep every page but the landing pages', () => {
    expect(['/', '/fr', '/?utm=x'].filter(isKeptWhenWhole)).toEqual([])
    expect(
      ['/bible', '/fr/bible', '/bible/lsg/gen/1', '/strong/fr/h0430'].every(isKeptWhenWhole)
    ).toBe(true)
  })

  it('turns an answer into what it means for the run', () => {
    expect(signalOf(page({ 'x-vercel-cache': 'HIT' }))).toBe('good')
    expect(signalOf(page({ 'x-vercel-cache': 'MISS' }))).toBe('good')
    expect(signalOf(page({}, 429))).toBe('limited')
    expect(signalOf(page({}, 502))).toBe('failed')
    expect(signalOf(page({}, 403))).toBe('refused')
    expect(signalOf(page({}, 404))).toBe('missing')
    expect(signalOf(page({}, 301))).toBe('missing')
  })
})

describe('warm-up pace', () => {
  const after = (pace: Pace, ...signals: Signal[]) =>
    signals.reduce((current, signal) => judge(current, { signal, era: current.era }).pace, pace)

  it('goes on at its rate while the answers are good', () => {
    const verdict = judge(startPace(60), { signal: 'good', era: 0 })

    expect(verdict).toEqual({
      pace: { rate: 60, ceiling: 60, era: 0, pauses: 0, good: 1, misses: 0 },
    })
  })

  it('pauses a minute and halves its rate at the first trouble', () => {
    for (const signal of ['limited', 'failed', 'incomplete'] as const) {
      const verdict = judge(startPace(60), { signal, era: 0 })

      expect(verdict.pauseMs, signal).toBe(60_000)
      expect(verdict.stop, signal).toBeUndefined()
      expect(verdict.pace, signal).toMatchObject({ rate: 30, era: 1, pauses: 1 })
    }
  })

  it('pauses longer each time, and for as long as the site asks', () => {
    const first = judge(startPace(60), { signal: 'limited', era: 0, retryAfterMs: 300_000 })
    const second = judge(first.pace, { signal: 'failed', era: 1 })
    const third = judge(second.pace, { signal: 'incomplete', era: 2, retryAfterMs: 1_000 })

    expect([first.pauseMs, second.pauseMs, third.pauseMs]).toEqual([300_000, 120_000, 240_000])
    expect([first.pace.rate, second.pace.rate, third.pace.rate]).toEqual([30, 15, 7])
  })

  it('stops at the trouble that follows its third pause', () => {
    const paused = after(startPace(60), 'limited', 'limited', 'limited')
    const verdict = judge(paused, { signal: 'limited', era: paused.era })

    expect(paused).toMatchObject({ pauses: 3, era: 3 })
    expect(verdict.pauseMs).toBeUndefined()
    expect(verdict.stop).toMatch(/429.*after 3 pauses/u)
  })

  it('counts the answers of one bad minute as one trouble', () => {
    const first = judge(startPace(60), { signal: 'limited', era: 0 })
    // Requests sent before the pause answer after it was decided.
    const second = judge(first.pace, { signal: 'limited', era: 0 })
    const third = judge(second.pace, { signal: 'failed', era: 0 })

    expect(second.pauseMs).toBeUndefined()
    expect(third.pauseMs).toBeUndefined()
    expect(third.pace).toMatchObject({ rate: 30, era: 1, pauses: 1 })
  })

  it('never falls under one page a minute', () => {
    expect(after(startPace(2), 'failed', 'failed', 'failed').rate).toBe(1)
  })

  it('forgives a pause after a hundred good answers, and gives the rate back after an error', () => {
    const paused = after(startPace(60), 'failed')
    const almost = after(paused, ...Array<Signal>(99).fill('good'))
    const forgiven = after(almost, 'good')

    expect(almost).toMatchObject({ pauses: 1, good: 99, rate: 30 })
    expect(forgiven).toMatchObject({ pauses: 0, good: 0, rate: 60, era: 1 })
    // Trouble in between starts the count again.
    expect(after(almost, 'incomplete', 'good')).toMatchObject({ pauses: 2, good: 1 })
  })

  it('never returns to a rate the site answered 429 or an incomplete page to', () => {
    for (const signal of ['limited', 'incomplete'] as const) {
      const forgiven = after(startPace(60), signal, ...Array<Signal>(100).fill('good'))

      expect(forgiven, signal).toMatchObject({ pauses: 0, rate: 30, ceiling: 30 })
      // An error later is forgiven up to that rate, not up to the first one.
      const again = after(forgiven, 'failed', ...Array<Signal>(100).fill('good'))
      expect(again, signal).toMatchObject({ pauses: 0, rate: 30, ceiling: 30 })
    }
  })

  it('takes a page that fails twice among good answers for a page in trouble, not the site', () => {
    const settled = after(startPace(60), 'failed', ...Array<Signal>(10).fill('good'))
    const event = { era: settled.era, again: true }

    expect(judge(settled, { ...event, signal: 'failed' })).toEqual({ pace: settled })
    expect(judge(settled, { ...event, signal: 'incomplete' })).toEqual({ pace: settled })
    // A 429 is never the trouble of one page, and nine good answers do not clear the site.
    expect(judge(settled, { ...event, signal: 'limited' }).pauseMs).toBe(120_000)
    const unsettled = after(startPace(60), 'failed', ...Array<Signal>(9).fill('good'))
    expect(judge(unsettled, { ...event, signal: 'failed' }).pauseMs).toBe(120_000)
  })

  it('stops at once when the site refuses the warm-up', () => {
    expect(judge(startPace(60), { signal: 'refused', era: 0 }).stop).toMatch(/refused/u)
  })

  it('stops when the sitemaps keep naming addresses that are not pages', () => {
    const nineteen = after(startPace(60), ...Array<Signal>(19).fill('missing'))

    expect(judge(nineteen, { signal: 'missing', era: 0 }).stop).toMatch(/20 addresses in a row/u)
    // A page in between: a missing address here and there is reported, and the run goes on.
    const mixed = after(nineteen, 'good', 'missing')
    expect(mixed).toMatchObject({ misses: 1, rate: 60, pauses: 0 })
  })
})

describe('warm-up journal and report', () => {
  const NOW = Date.parse('2026-10-08T12:00:00Z')
  const record = (overrides: Partial<PageRecord>): PageRecord => ({
    path: '/bible/lsg/gen/1',
    at: '2026-10-08T11:00:00.000Z',
    kind: 'rendered',
    completeness: 'unknown',
    status: 200,
    ms: 640,
    pass: 'first',
    ...overrides,
  })
  const journalOf = (...records: object[]) => records.map(line => JSON.stringify(line)).join('\n')

  it('skips on resume the pages whose last answer was a page', () => {
    const journal = journalOf(
      { run: { origin: ORIGIN } },
      record({ path: '/a' }),
      record({ path: '/b', kind: 'cached', completeness: 'whole' }),
      record({ path: '/c', kind: 'failed', status: 502 }),
      record({ path: '/d', kind: 'limited', status: 429 }),
      record({ path: '/d', pass: 'retry' }),
      record({ path: '/e' }),
      record({ path: '/e', completeness: 'incomplete', pass: 'retry' }),
      record({ path: '/f', kind: 'missing', status: 404 }),
      { end: { stop: 'interrupted' } }
    )

    expect([...warmPaths(journal, NOW)].sort()).toEqual(['/a', '/b', '/d'])
  })

  it('does not vouch for a page beyond the day the CDN keeps it', () => {
    const journal = journalOf(
      record({ path: '/yesterday', at: '2026-10-07T11:59:59.000Z' }),
      record({ path: '/today', at: '2026-10-07T12:00:01.000Z' })
    )

    expect([...warmPaths(journal, NOW)]).toEqual(['/today'])
  })

  it('reads a journal whose last line was cut', () => {
    const journal = `${journalOf(record({ path: '/a' }))}\n{"path":"/b","at":"2026-10-0`

    expect([...warmPaths(journal, NOW)]).toEqual(['/a'])
    expect(warmPaths('', NOW).size).toBe(0)
  })

  it('says how long answers took', () => {
    const times = Array.from({ length: 100 }, (_, index) => 100 - index)

    expect(timeDistribution(times)).toEqual({
      count: 100,
      min: 1,
      p50: 50,
      p90: 90,
      p99: 99,
      max: 100,
    })
    expect(timeDistribution([640])).toEqual({
      count: 1,
      min: 640,
      p50: 640,
      p90: 640,
      p99: 640,
      max: 640,
    })
    expect(timeDistribution([])).toBeUndefined()
  })

  it('counts a page once, by what the run found', () => {
    const summary = summarize([
      record({ path: '/a', kind: 'cached', completeness: 'whole', ms: 40, cache: 'HIT' }),
      record({ path: '/b', ms: 600 }),
      record({ path: '/c', ms: 900, completeness: 'incomplete' }),
      record({ path: '/d', kind: 'limited', status: 429, ms: 30 }),
      record({ path: '/e', kind: 'failed', status: 0, ms: 45_000 }),
      record({ path: '/f', kind: 'missing', status: 404, ms: 50 }),
      record({ path: '/g', kind: 'redirected', status: 308, ms: 50 }),
      record({ path: '/h', kind: 'stale', completeness: 'whole', ms: 60 }),
      record({ path: '/c', ms: 700, pass: 'retry' }),
      record({ path: '/d', kind: 'limited', status: 429, ms: 30, pass: 'retry' }),
      record({ path: '/b', kind: 'cached', completeness: 'whole', ms: 45, pass: 'verify' }),
      record({ path: '/c', ms: 650, pass: 'verify' }),
    ])

    expect(summary).toMatchObject({
      requests: 12,
      pages: 8,
      cached: 1,
      stale: 1,
      rendered: 2,
      incomplete: 1,
      limited: 1,
      failed: 1,
      refused: 0,
      missing: 1,
      redirected: 1,
      retried: 2,
      recovered: 1,
      verified: 2,
      kept: 1,
    })
    expect(summary.times.rendered).toMatchObject({ count: 2, min: 600, max: 900 })
    expect(summary.times.cached).toMatchObject({ count: 1, p50: 40 })
  })
})

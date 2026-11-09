import {
  createIncomingLinkTab,
  findTabWithSameContent,
  isSameTabContent,
  parseIncomingLink,
} from '../incomingLinks'
import type { BibleTab, TabGroup, TabItem } from '~state/tabs'

jest.mock('~helpers/bibleVersions', () => ({ versions: { LSG: {}, NASB2020: {} } }))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))
jest.mock('~state/tabs', () => ({
  getBibleContextDisplayMode: (data: { contextDisplayMode?: string; isReadOnly?: boolean }) =>
    data.contextDisplayMode ?? (data.isReadOnly ? 'focused' : 'fullChapter'),
  getDefaultBibleTab: (version: string) => ({
    id: 'bible-default',
    isRemovable: true,
    title: 'Genèse 1:1',
    type: 'bible',
    data: {
      selectedVersion: version,
      strongMode: 'hidden',
      interlinearMode: 'hidden',
      selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
      selectedChapter: 1,
      selectedVerse: 1,
      parallelVersions: [],
      temp: {
        selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
        selectedChapter: 1,
        selectedVerse: 1,
      },
      selectedVerses: {},
      selectionMode: 'grid',
      isSelectionMode: undefined,
    },
  }),
}))

const group = (id: string, tabs: TabItem[]): TabGroup => ({
  id,
  name: id,
  isDefault: id === 'default',
  tabs,
  activeTabIndex: 0,
  createdAt: 0,
  updatedAt: 0,
})

const tabFor = (address: string) => {
  const target = parseIncomingLink(address)
  if (!target) throw new Error(`no target for ${address}`)
  return createIncomingLinkTab(target)
}

describe('parseIncomingLink', () => {
  it('reads the public resources a Tab can show', () => {
    expect(
      parseIncomingLink('https://web.bible-strong.app/bible/nasb2020/strong/jer/32/17')
    ).toEqual({
      kind: 'bible',
      route: expect.objectContaining({
        version: 'NASB2020',
        presentation: 'strong',
        chapter: 32,
        passage: { startVerse: 17 },
      }),
    })
    expect(parseIncomingLink('/strong/h1234')).toEqual({
      kind: 'strong',
      identity: expect.objectContaining({ code: 'H1234' }),
    })
    expect(parseIncomingLink('/dictionary/fr/westphal/42/abraham')?.kind).toBe('dictionary')
    expect(parseIncomingLink('/nave/fr/b%C3%A9n%C3%A9diction')).toEqual({
      kind: 'nave',
      route: { language: 'fr', topic: 'bénédiction' },
    })
    expect(parseIncomingLink('/timeline/en')).toEqual({
      kind: 'timeline',
      route: { language: 'en' },
    })
    expect(parseIncomingLink('/timeline/fr/the-flood')).toEqual({
      kind: 'timeline',
      route: { language: 'fr', slug: 'the-flood' },
    })
  })

  it('reads a non-canonical Bible address as its route does', () => {
    expect(parseIncomingLink('/bible/lsg/jean/3/')).toEqual({
      kind: 'bible',
      route: expect.objectContaining({ version: 'LSG', chapter: 3, presentation: 'text' }),
    })
  })

  it('leaves the pages a Tab cannot show, and every other screen, to their route', () => {
    for (const address of [
      '/',
      '/home',
      '/login',
      '/plans',
      '/strong/h1234/concordance',
      '/strong/entity/abraham',
      '/strong?reference=H1234',
      '/bible/unknown/john/3',
      '/bible/lsg/john/99',
      '/nave/%E0%A4%A',
    ]) {
      expect(parseIncomingLink(address)).toBeUndefined()
    }
  })
})

describe('createIncomingLinkTab', () => {
  it('opens a Bible address on its verse, in its presentation', () => {
    const tab = tabFor('/bible/nasb2020/strong/jer/32/17') as BibleTab
    expect(tab.type).toBe('bible')
    expect(tab.data).toEqual(
      expect.objectContaining({
        selectedVersion: 'NASB2020',
        selectedChapter: 32,
        selectedVerse: 17,
        focusVerses: [17],
        contextDisplayMode: 'focused',
        strongMode: 'visible',
        parallelVersions: [],
      })
    )
    expect(tab.data.selectedBook.Numero).toBe(24)
  })

  it('opens a whole chapter without a verse in focus', () => {
    const tab = tabFor('/bible/lsg/john/3') as BibleTab
    expect(tab.data.contextDisplayMode).toBe('fullChapter')
    expect(tab.data.focusVerses).toBeUndefined()
    expect(tab.data.strongMode).toBe('hidden')
  })

  it('gives each resource the data its route screen reads', () => {
    expect(tabFor('/strong/g26')).toEqual(
      expect.objectContaining({
        type: 'strong',
        data: { book: 40, reference: 'G0026', identityKind: 'strong', identityCode: 'G0026' },
      })
    )
    expect(tabFor('/dictionary/fr/westphal/42/abraham')).toEqual(
      expect.objectContaining({
        type: 'dictionary',
        data: { language: 'fr', work: 'westphal', entryId: 42, word: 'abraham' },
      })
    )
    expect(tabFor('/timeline/fr/the-flood')).toEqual(
      expect.objectContaining({
        type: 'timeline',
        data: { language: 'fr', eventSlug: 'the-flood' },
      })
    )
  })
})

describe('isSameTabContent', () => {
  it('matches a Tab that shows exactly the same thing', () => {
    const link = tabFor('/bible/nasb2020/strong/jer/32/17')
    expect(isSameTabContent(tabFor('/bible/nasb2020/strong/jer/32/17'), link)).toBe(true)
    expect(isSameTabContent(tabFor('/strong/H26'), tabFor('/strong/h26'))).toBe(true)
  })

  it('does not match the same chapter shown otherwise', () => {
    const link = tabFor('/bible/nasb2020/strong/jer/32/17')
    for (const other of [
      '/bible/nasb2020/jer/32/17',
      '/bible/nasb2020/strong/jer/32/18',
      '/bible/nasb2020/strong/jer/32',
      '/bible/lsg/jer/32/17',
    ]) {
      expect(isSameTabContent(tabFor(other), link)).toBe(false)
    }
    const tab = tabFor('/bible/nasb2020/strong/jer/32/17') as BibleTab
    const parallel = { ...tab, data: { ...tab.data, parallelVersions: ['LSG' as const] } }
    expect(isSameTabContent(parallel, link)).toBe(false)
  })

  it('ignores where the reader scrolled in a whole chapter', () => {
    const chapter = tabFor('/bible/lsg/john/3') as BibleTab
    const scrolled = { ...chapter, data: { ...chapter.data, selectedVerse: 16 } }
    expect(isSameTabContent(scrolled, tabFor('/bible/lsg/john/3'))).toBe(true)
  })
})

describe('findTabWithSameContent', () => {
  it('looks in the active group first, then in the others', () => {
    const link = tabFor('/strong/h1')
    const inActive = { ...tabFor('/strong/h1'), id: 'active-copy' }
    const inOther = { ...tabFor('/strong/h1'), id: 'other-copy' }
    const groups = [group('other', [inOther]), group('default', [tabFor('/strong/h2'), inActive])]

    expect(findTabWithSameContent(groups, 'default', link)).toEqual({
      groupId: 'default',
      tabId: 'active-copy',
    })
    expect(findTabWithSameContent([groups[0]!], 'default', link)).toEqual({
      groupId: 'other',
      tabId: 'other-copy',
    })
    expect(findTabWithSameContent(groups, 'default', tabFor('/strong/h3'))).toBeUndefined()
  })
})

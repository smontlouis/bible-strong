import { getBook } from '~helpers/bibleBookCatalog'
import { createPublicBibleNavigation, createPublicBibleTab } from '../publicBibleNavigation'

jest.mock('~state/tabs', () => ({
  getDefaultBibleTab: (version: string) => {
    const firstBook = { Numero: 1, Nom: 'Genèse', Chapitres: 50 }
    return {
      id: 'bible-test',
      title: 'Genèse 1:1',
      type: 'bible',
      isRemovable: true,
      data: {
        selectedVersion: version,
        selectedBook: firstBook,
        selectedChapter: 1,
        selectedVerse: 1,
        temp: { selectedBook: firstBook, selectedChapter: 1, selectedVerse: 1 },
        selectedVerses: {},
        parallelVersions: [],
        selectionMode: 'grid',
      },
    }
  },
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    LSG: { id: 'LSG' },
    NBS: { id: 'NBS' },
    BHG: { id: 'BHG' },
  },
}))

const push = jest.fn()
const replace = jest.fn()
const current = {
  version: 'LSG',
  presentation: 'strong' as const,
  book: getBook(43)!,
  chapter: 3,
  passage: { startVerse: 16 },
}

describe('public Bible navigation', () => {
  beforeEach(() => {
    push.mockClear()
    replace.mockClear()
  })

  it('pushes chapter changes and removes the focused passage', () => {
    createPublicBibleNavigation(current, { push, replace }).openChapter(getBook(43)!, 4)
    expect(push).toHaveBeenCalledWith('/bible/lsg/strong/john/4')
  })

  it('replaces version changes and drops an unsupported presentation', () => {
    createPublicBibleNavigation(current, { push, replace }).changeVersion('NBS')
    expect(replace).toHaveBeenCalledWith('/bible/nbs/john/3/16')
  })

  it.each([
    ['hidden', '/bible/lsg/john/3/16'],
    ['visible', '/bible/lsg/strong/john/3/16'],
    ['reverse-interlinear', '/bible/lsg/reverse-interlinear/john/3/16'],
  ] as const)('replaces the %s Strong presentation', (mode, path) => {
    createPublicBibleNavigation(current, { push, replace }).changeStrongMode(mode)
    expect(replace).toHaveBeenCalledWith(path)
  })

  it('routes the interlinear display of the original-language Bible', () => {
    const original = { ...current, version: 'BHG', presentation: 'text' as const }
    const navigation = createPublicBibleNavigation(original, { push, replace })

    expect(navigation.changeInterlinearMode?.('interlinear', 'en')).toBe(true)
    expect(replace).toHaveBeenLastCalledWith('/bible/bhg/interlinear/en/john/3/16')

    const interlinear = {
      ...original,
      presentation: 'interlinear' as const,
      glossLanguage: 'en' as const,
    }
    const reading = createPublicBibleNavigation(interlinear, { push, replace })
    expect(reading.changeInterlinearMode?.('hidden')).toBe(true)
    expect(replace).toHaveBeenLastCalledWith('/bible/bhg/john/3/16')

    // A display without a route stays in the tab, as does any display of a translation.
    replace.mockClear()
    expect(reading.changeInterlinearMode?.('transliteration')).toBe(false)
    expect(
      createPublicBibleNavigation(current, { push, replace }).changeInterlinearMode?.('interlinear')
    ).toBe(false)
    expect(replace).not.toHaveBeenCalled()

    expect(createPublicBibleTab(interlinear, 'Jean 3:16 · BHG').data).toMatchObject({
      interlinearMode: 'interlinear',
      interlinearLocale: 'en',
      strongMode: 'hidden',
    })
  })

  it('creates an active Bible tab from the public passage', () => {
    const tab = createPublicBibleTab(
      { ...current, passage: { startVerse: 16, endVerse: 18 } },
      'Jean 3:16–18 · LSG'
    )

    expect(tab).toMatchObject({
      title: 'Jean 3:16–18 · LSG',
      type: 'bible',
      data: {
        selectedVersion: 'LSG',
        selectedBook: getBook(43),
        selectedChapter: 3,
        selectedVerse: 16,
        focusVerses: [16, 17, 18],
        contextDisplayMode: 'focused',
        strongMode: 'visible',
      },
    })
  })
})

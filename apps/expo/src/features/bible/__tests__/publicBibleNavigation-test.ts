import { getBook } from '~helpers/bibleBookCatalog'
import { createPublicBibleNavigation } from '../publicBibleNavigation'

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    LSG: { id: 'LSG' },
    NBS: { id: 'NBS' },
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
})

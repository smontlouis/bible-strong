import books from '~assets/bible_versions/books-desc'
import { applyBookChapterSelection } from '../bookSelectorSelection'

const genesis = books.find(book => book.Numero === 1)!
const psalms = books.find(book => book.Numero === 19)!

const createDependencies = () => ({
  actions: {
    setTempSelectedBook: jest.fn(),
    setTempSelectedChapter: jest.fn(),
    setTempSelectedVerse: jest.fn(),
    validateTempSelected: jest.fn(),
  },
  dismissBookSelector: jest.fn(),
  presentVerseSelector: jest.fn(),
  setVerseSelectorBook: jest.fn(),
  setVerseSelectorChapter: jest.fn(),
})

describe('applyBookChapterSelection', () => {
  it('keeps without-verses navigation semantics for the final Genesis chapter', () => {
    const dependencies = createDependencies()

    applyBookChapterSelection({ book: genesis, chapter: 50 }, { hasVerses: false, ...dependencies })

    expect(dependencies.actions.setTempSelectedBook).toHaveBeenCalledWith(genesis)
    expect(dependencies.actions.setTempSelectedChapter).toHaveBeenCalledWith(50)
    expect(dependencies.actions.setTempSelectedVerse).toHaveBeenCalledWith(1)
    expect(dependencies.actions.validateTempSelected).toHaveBeenCalledTimes(1)
    expect(dependencies.dismissBookSelector).toHaveBeenCalledTimes(1)
    expect(dependencies.setVerseSelectorBook).not.toHaveBeenCalled()
    expect(dependencies.setVerseSelectorChapter).not.toHaveBeenCalled()
    expect(dependencies.presentVerseSelector).not.toHaveBeenCalled()
  })

  it('keeps with-verses navigation semantics for the final Psalm', () => {
    const dependencies = createDependencies()

    applyBookChapterSelection({ book: psalms, chapter: 150 }, { hasVerses: true, ...dependencies })

    expect(dependencies.setVerseSelectorBook).toHaveBeenCalledWith(psalms)
    expect(dependencies.setVerseSelectorChapter).toHaveBeenCalledWith(150)
    expect(dependencies.actions.setTempSelectedBook).toHaveBeenCalledWith(psalms)
    expect(dependencies.actions.setTempSelectedChapter).toHaveBeenCalledWith(150)
    expect(dependencies.presentVerseSelector).toHaveBeenCalledTimes(1)
    expect(dependencies.actions.setTempSelectedVerse).not.toHaveBeenCalled()
    expect(dependencies.actions.validateTempSelected).not.toHaveBeenCalled()
    expect(dependencies.dismissBookSelector).not.toHaveBeenCalled()
  })
})

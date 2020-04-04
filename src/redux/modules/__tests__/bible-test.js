/* eslint-env jest */

import reducer, * as BibleActions from '../bible'
import booksDesc from '~assets/bible_versions/books-desc'

const initialState = {
  selectedVersion: 'LSG',
  selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  selectedChapter: 1,
  selectedVerse: 1,
  temp: {
    selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
    selectedChapter: 1,
    selectedVerse: 1,
  },
  selectedVerses: {}, // highlighted verses
}

describe('Bible Reducer', () => {
  it('should handle SET_TEMP_SELECTED_BOOK', () => {
    const newState = reducer(
      undefined,
      BibleActions.setTempSelectedBook(booksDesc[2])
    )
    expect(newState).toEqual({
      ...initialState,
      temp: {
        ...initialState.temp,
        selectedBook: booksDesc[2],
      },
    })
  })

  it('should handle SET_TEMP_SELECTED_CHAPTER', () => {
    const newState = reducer(undefined, BibleActions.setTempSelectedChapter(4))
    expect(newState).toEqual({
      ...initialState,
      temp: {
        ...initialState.temp,
        selectedChapter: 4,
      },
    })
  })

  it('should handle SET_TEMP_SELECTED_VERSE', () => {
    const newState = reducer(undefined, BibleActions.setTempSelectedVerse(10))
    expect(newState).toEqual({
      ...initialState,
      temp: {
        ...initialState.temp,
        selectedVerse: 10,
      },
    })
  })

  it('should handle SET_ALL_AND_VALIDATE_SELECTED', () => {
    const newState = reducer(
      undefined,
      BibleActions.setAllAndValidateSelected({
        book: booksDesc[4],
        chapter: 2,
        verse: 1,
        version: 'OST',
      })
    )
    expect(newState).toMatchSnapshot()
  })

  it('should handle VALIDATE_SELECTED', () => {
    const newState = reducer(
      {
        ...initialState,
        temp: {
          selectedBook: booksDesc[6],
          selectedChapter: 5,
          selectedVerse: 8,
        },
      },
      BibleActions.validateSelected()
    )
    expect(newState).toMatchSnapshot()
  })

  it('should handle RESET_TEMP_SELECTED', () => {
    const newState = reducer(
      {
        ...initialState,
        temp: {
          selectedBook: booksDesc[6],
          selectedChapter: 5,
          selectedVerse: 8,
        },
      },
      BibleActions.resetTempSelected()
    )
    expect(newState).toMatchSnapshot()
  })

  it('should handle SET_VERSION', () => {
    const newState = reducer(undefined, BibleActions.setVersion('OST'))
    expect(newState).toEqual({
      ...initialState,
      selectedVersion: 'OST',
    })
  })

  it('should handle ADD_SELECTED_VERSES', () => {
    const newState = reducer(
      {
        ...initialState,
        selectedVerses: {
          1: true,
          3: true,
          5: true,
        },
      },
      BibleActions.addSelectedVerse(4)
    )
    expect(newState).toEqual({
      ...initialState,
      selectedVerses: {
        1: true,
        3: true,
        5: true,
        4: true,
      },
    })
  })

  it('should handle REMOVE_SELECTED_VERSES', () => {
    const newState = reducer(
      {
        ...initialState,
        selectedVerses: {
          1: true,
          3: true,
          5: true,
        },
      },
      BibleActions.removeSelectedVerse(3)
    )
    expect(newState).toEqual({
      ...initialState,
      selectedVerses: {
        1: true,
        5: true,
      },
    })
  })

  it('should handle CLEAR_SELECTED_VERSES', () => {
    const newState = reducer(
      {
        ...initialState,
        selectedVerses: {
          1: true,
          3: true,
          5: true,
        },
      },
      BibleActions.clearSelectedVerses()
    )
    expect(newState).toEqual({
      ...initialState,
      selectedVerses: {},
    })
  })

  it('should handle GO_TO_PREV_CHAPTER - When Genesis & chapter 1 nothing happens', () => {
    const newState = reducer(initialState, BibleActions.goToPrevChapter())
    expect(newState).toEqual(newState)
  })

  it('should handle GO_TO_PREV_CHAPTER - When Chapter 2 should go to 1', () => {
    const newState = reducer(
      {
        ...initialState,
        selectedChapter: 2,
        temp: {
          ...initialState.temp,
          selectedChapter: 2,
        },
      },
      BibleActions.goToPrevChapter()
    )
    expect(newState).toEqual({
      ...initialState,
      selectedChapter: 1,
      temp: {
        ...initialState.temp,
        selectedChapter: 1,
      },
    })
  })

  it('should handle GO_TO_PREV_CHAPTER - When Chapter 1 it should go to last chapter prev Book', () => {
    const newState = reducer(
      {
        ...initialState,
        selectedBook: booksDesc[1],
        temp: {
          ...initialState.temp,
          selectedBook: booksDesc[1],
        },
      },
      BibleActions.goToPrevChapter()
    )
    expect(newState).toEqual({
      ...initialState,
      selectedChapter: 50,
      temp: {
        ...initialState.temp,
        selectedChapter: 50,
      },
    })
  })

  it('should handle GO_TO_NEXT_CHAPTER - When Revelations & last chapter nothing happens', () => {
    const newState = reducer(
      {
        ...initialState,
        selectedBook: booksDesc[65],
        selectedChapter: 22,
        temp: {
          ...initialState.temp,
          selectedBook: booksDesc[65],
          selectedChapter: 22,
        },
      },
      BibleActions.goToNextChapter()
    )
    expect(newState).toEqual(newState)
  })

  it('should handle GO_TO_NEXT_CHAPTER - When Chapter 1 should go to 2', () => {
    const newState = reducer(initialState, BibleActions.goToNextChapter())
    expect(newState).toEqual({
      ...initialState,
      selectedChapter: 2,
      temp: {
        ...initialState.temp,
        selectedChapter: 2,
      },
    })
  })

  it('should handle GO_TO_NEXT_CHAPTER - When last chapter it should go to first chapter next Book', () => {
    const newState = reducer(
      {
        ...initialState,
        selectedChapter: 50,
        temp: {
          ...initialState.temp,
          selectedChapter: 50,
        },
      },
      BibleActions.goToNextChapter()
    )
    expect(newState).toEqual({
      ...initialState,
      selectedBook: booksDesc[1],
      selectedChapter: 1,
      temp: {
        ...initialState.temp,
        selectedBook: booksDesc[1],
        selectedChapter: 1,
      },
    })
  })
})

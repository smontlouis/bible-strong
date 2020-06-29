import produce, { Draft } from 'immer'
import analytics from '@react-native-firebase/analytics'

import books, { Book } from '~assets/bible_versions/books-desc'
import { isFR } from '../../../i18n'

const SET_TEMP_SELECTED_BOOK = 'bible/SET_TEMP_SELECTED_BOOK'
const SET_TEMP_SELECTED_CHAPTER = 'bible/SET_TEMP_SELECTED_CHAPTER'
const SET_TEMP_SELECTED_VERSE = 'bible/SET_TEMP_SELECTED_VERSE'
const SET_SELECTED_VERSE = 'bible/SET_SELECTED_VERSE'
const VALIDATE_SELECTED = 'bible/VALIDATE_SELECTED'
const SET_ALL_AND_VALIDATE_SELECTED = 'bible/SET_ALL_AND_VALIDATE_SELECTED'
const RESET_TEMP_SELECTED = 'bible/RESET_TEMP_SELECTED'
const SET_VERSION = 'bible/SET_VERSION'
const ADD_HIGHLIGHTED_VERSE = 'bible/ADD_HIGHLIGHTED_VERSE'
const ADD_HIGHLIGHTED_VERSES = 'bible/ADD_HIGHLIGHTED_VERSES'
const REMOVE_HIGHLIGHTED_VERSE = 'bible/REMOVE_HIGHLIGHTED_VERSE'
const CLEAR_HIGHLIGHTED_VERSES = 'bible/CLEAR_HIGHLIGHTED_VERSES'
const GO_TO_PREV_CHAPTER = 'bible/GO_TO_PREV_CHAPTER'
const GO_TO_NEXT_CHAPTER = 'bible/GO_TO_NEXT_CHAPTER'

const ADD_PARALLEL_VERSION = 'bible/ADD_PARALLEL_VERSION'
const REMOVE_PARALLEL_VERSION = 'bible/REMOVE_PARALLEL_VERSION'
const REMOVE_ALL_PARALLEL_VERSIONS = 'bible/REMOVE_ALL_PARALLEL_VERSIONS'

const TOGGLE_SELECTION_MODE = 'bible/TOGGLE_SELECTION_MODE'

interface BibleState {
  selectedVersion: string
  selectedBook: Book
  selectedChapter: number
  selectedVerse: number
  parallelVersions: string[]
  temp: {
    selectedBook: Book
    selectedChapter: number
    selectedVerse: number
  }
  selectedVerses: { [verse: string]: true }
  selectionMode: 'grid' | 'list'
}

const initialState: BibleState = {
  selectedVersion: isFR ? 'LSG' : 'KJV',
  selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  selectedChapter: 1,
  selectedVerse: 1,
  parallelVersions: [],
  temp: {
    selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
    selectedChapter: 1,
    selectedVerse: 1,
  },
  selectedVerses: {}, // highlighted verses,
  selectionMode: 'grid',
}

// BibleReducer
export default produce((draft: Draft<BibleState>, action) => {
  switch (action.type) {
    case TOGGLE_SELECTION_MODE: {
      if (draft.selectionMode === 'grid') {
        draft.selectionMode = 'list'
      } else {
        draft.selectionMode = 'grid'
      }

      break
    }
    case ADD_PARALLEL_VERSION: {
      // if (draft.selectedVersion === 'INT') {
      //   draft.selectedVersion = 'LSG'
      // }
      draft.parallelVersions.push(isFR ? 'LSG' : 'KJV')
      break
    }
    case REMOVE_PARALLEL_VERSION: {
      draft.parallelVersions = draft.parallelVersions.filter(
        (p, i) => i !== action.payload
      )
      break
    }
    case REMOVE_ALL_PARALLEL_VERSIONS: {
      draft.parallelVersions = []
      break
    }
    case SET_TEMP_SELECTED_BOOK: {
      draft.temp = {
        selectedBook: action.book,
        selectedChapter: 1,
        selectedVerse: 1,
      }
      return
    }
    case SET_TEMP_SELECTED_CHAPTER: {
      draft.temp = {
        ...draft.temp,
        selectedChapter: action.chapter,
        selectedVerse: 1,
      }
      return
    }
    case SET_TEMP_SELECTED_VERSE: {
      draft.temp.selectedVerse = action.verse
      return
    }
    case SET_SELECTED_VERSE: {
      draft.selectedVerse = action.verse
      return
    }
    case SET_ALL_AND_VALIDATE_SELECTED: {
      draft.temp = {
        selectedBook: action.selected.book || draft.temp.selectedBook,
        selectedChapter: action.selected.chapter || draft.temp.selectedChapter,
        selectedVerse: action.selected.verse || draft.temp.selectedVerse,
      }
      draft.selectedVersion = action.selected.version || draft.selectedVersion
      draft.selectedBook = action.selected.book || draft.selectedBook
      draft.selectedChapter = action.selected.chapter || draft.selectedChapter
      draft.selectedVerse = action.selected.verse || draft.selectedVerse
      return
    }
    case VALIDATE_SELECTED: {
      draft.selectedBook = draft.temp.selectedBook
      draft.selectedChapter = draft.temp.selectedChapter
      draft.selectedVerse = draft.temp.selectedVerse
      return
    }
    case RESET_TEMP_SELECTED: {
      draft.temp = {
        selectedBook: draft.selectedBook,
        selectedChapter: draft.selectedChapter,
        selectedVerse: draft.selectedVerse,
      }
      return
    }
    case SET_VERSION: {
      // if (action.version === 'INT') {
      //   draft.parallelVersions = []
      // }

      if (typeof action.parallelVersionIndex !== 'undefined') {
        draft.parallelVersions[action.parallelVersionIndex] = action.version
        //  === 'INT' ? 'LSG' : action.version
      } else {
        draft.selectedVersion = action.version
      }
      return
    }
    case ADD_HIGHLIGHTED_VERSE: {
      draft.selectedVerses = {
        ...draft.selectedVerses,
        [action.id]: true,
      }
      return
    }
    case ADD_HIGHLIGHTED_VERSES: {
      draft.selectedVerses = action.ids
      return
    }
    case REMOVE_HIGHLIGHTED_VERSE: {
      delete draft.selectedVerses[action.id]
      return
    }
    case CLEAR_HIGHLIGHTED_VERSES: {
      draft.selectedVerses = {}
      return
    }
    case GO_TO_PREV_CHAPTER: {
      if (draft.selectedBook.Numero === 1 && draft.selectedChapter === 1) {
        return
      }

      const currentChapter = draft.selectedChapter

      if (currentChapter === 1) {
        const currentBook = draft.selectedBook
        const currentBookIndex = books.findIndex(
          b => b.Numero === currentBook.Numero
        )

        const prevBook = books[currentBookIndex - 1]
        draft.selectedBook = prevBook
        draft.selectedChapter = prevBook.Chapitres
        draft.selectedVerse = 1
        draft.temp = {
          selectedBook: prevBook,
          selectedChapter: prevBook.Chapitres,
          selectedVerse: 1,
        }

        return
      }

      draft.selectedChapter = currentChapter - 1
      draft.selectedVerse = 1
      draft.temp.selectedChapter = currentChapter - 1
      draft.temp.selectedVerse = 1

      return
    }
    case GO_TO_NEXT_CHAPTER: {
      if (
        draft.selectedBook.Numero === 66 &&
        draft.selectedChapter === draft.selectedBook.Chapitres
      ) {
        return
      }

      const currentChapter = draft.selectedChapter
      const currentBook = draft.selectedBook

      if (currentChapter === currentBook.Chapitres) {
        const currentBookIndex = books.findIndex(
          b => b.Numero === currentBook.Numero
        )

        const nextBook = books[currentBookIndex + 1]

        draft.selectedBook = nextBook
        draft.selectedChapter = 1
        draft.selectedVerse = 1
        draft.temp = {
          selectedBook: nextBook,
          selectedChapter: 1,
          selectedVerse: 1,
        }

        return
      }

      draft.selectedChapter = currentChapter + 1
      draft.selectedVerse = 1
      draft.temp.selectedChapter = currentChapter + 1
      draft.temp.selectedVerse = 1

      return
    }
    default: {
      break
    }
  }
}, initialState)

export function addParallelVersion() {
  return {
    type: ADD_PARALLEL_VERSION,
  }
}

export function toggleSelectionMode() {
  return {
    type: TOGGLE_SELECTION_MODE,
  }
}

export function removeParallelVersion(index) {
  return {
    type: REMOVE_PARALLEL_VERSION,
    payload: index,
  }
}

export function removeAllParallelVersions() {
  return {
    type: REMOVE_ALL_PARALLEL_VERSIONS,
  }
}

export function setTempSelectedBook(book) {
  return {
    type: SET_TEMP_SELECTED_BOOK,
    book,
  }
}

export function setTempSelectedChapter(chapter) {
  return {
    type: SET_TEMP_SELECTED_CHAPTER,
    chapter,
  }
}

export function setTempSelectedVerse(verse) {
  return {
    type: SET_TEMP_SELECTED_VERSE,
    verse,
  }
}

export function setSelectedVerse(verse) {
  return {
    type: SET_SELECTED_VERSE,
    verse,
  }
}

export function validateSelected() {
  return {
    type: VALIDATE_SELECTED,
  }
}

export function setAllAndValidateSelected(selected) {
  return {
    type: SET_ALL_AND_VALIDATE_SELECTED,
    selected,
  }
}

export function setAllAndValidateSelectedAsync(selected) {
  return dispatch =>
    new Promise(resolve => {
      dispatch(setAllAndValidateSelected(selected))
      resolve()
    })
}

export function resetTempSelected() {
  return {
    type: RESET_TEMP_SELECTED,
  }
}

export function setVersion(version, parallelVersionIndex) {
  if (!__DEV__) {
    analytics().logEvent('version_bible', {
      version,
    })
  }
  return {
    type: SET_VERSION,
    parallelVersionIndex,
    version,
  }
}

export function goToPrevChapter() {
  return {
    type: GO_TO_PREV_CHAPTER,
  }
}

export function goToNextChapter() {
  return {
    type: GO_TO_NEXT_CHAPTER,
  }
}

export function goToNextVerse(nbVerses) {
  return (dispatch, getState) => {
    let { selectedVerse } = getState().bible

    if (selectedVerse === nbVerses) {
      return null
    }

    dispatch(setSelectedVerse(++selectedVerse))
  }
}

export function goToPrevVerse(nbVerses) {
  return (dispatch, getState) => {
    let { selectedVerse } = getState().bible

    if (selectedVerse === 1) {
      return null
    }

    dispatch(setSelectedVerse(--selectedVerse))
  }
}

export function addSelectedVerse(id) {
  return {
    type: ADD_HIGHLIGHTED_VERSE,
    id,
  }
}

export function addAllSelectedVerses(ids) {
  return {
    type: ADD_HIGHLIGHTED_VERSES,
    ids,
  }
}

export function removeSelectedVerse(id) {
  return {
    type: REMOVE_HIGHLIGHTED_VERSE,
    id,
  }
}

export function clearSelectedVerses() {
  return {
    type: CLEAR_HIGHLIGHTED_VERSES,
  }
}

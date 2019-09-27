import produce from 'immer'
import books from '~assets/bible_versions/books-desc'
import Analytics, { event } from '~helpers/analytics'

const SET_TEMP_SELECTED_BOOK = 'bible/SET_TEMP_SELECTED_BOOK'
const SET_TEMP_SELECTED_CHAPTER = 'bible/SET_TEMP_SELECTED_CHAPTER'
const SET_TEMP_SELECTED_VERSE = 'bible/SET_TEMP_SELECTED_VERSE'
const SET_SELECTED_VERSE = 'bible/SET_SELECTED_VERSE'
const VALIDATE_SELECTED = 'bible/VALIDATE_SELECTED'
const SET_ALL_AND_VALIDATE_SELECTED = 'bible/SET_ALL_AND_VALIDATE_SELECTED'
const RESET_TEMP_SELECTED = 'bible/RESET_TEMP_SELECTED'
const SET_VERSION = 'bible/SET_VERSION'
const ADD_HIGHLIGHTED_VERSE = 'bible/ADD_HIGHLIGHTED_VERSE'
const REMOVE_HIGHLIGHTED_VERSE = 'bible/REMOVE_HIGHLIGHTED_VERSE'
const CLEAR_HIGHLIGHTED_VERSES = 'bible/CLEAR_HIGHLIGHTED_VERSES'
const GO_TO_PREV_CHAPTER = 'bible/GO_TO_PREV_CHAPTER'
const GO_TO_NEXT_CHAPTER = 'bible/GO_TO_NEXT_CHAPTER'
const SET_STRONG_DATABASE_HASH = 'bible/SET_STRONG_DATABASE_HASH'
const SET_DICTIONNAIRE_DATABASE_HASH = 'bible/SET_DICTIONNAIRE_DATABASE_HASH'

const initialState = {
  selectedVersion: 'LSG',
  selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  selectedChapter: 1,
  selectedVerse: 1,
  temp: {
    selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
    selectedChapter: 1,
    selectedVerse: 1
  },
  selectedVerses: {}, // highlighted verses,
  strongDatabaseHash: '',
  dictionnaireDatabaseHash: ''
}

// BibleReducer
export default produce((draft, action) => {
  switch (action.type) {
    case SET_TEMP_SELECTED_BOOK: {
      draft.temp = {
        selectedBook: action.book,
        selectedChapter: 1,
        selectedVerse: 1
      }
      return
    }
    case SET_TEMP_SELECTED_CHAPTER: {
      draft.temp = {
        ...draft.temp,
        selectedChapter: action.chapter,
        selectedVerse: 1
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
        selectedVerse: action.selected.verse || draft.temp.selectedVerse
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
        selectedVerse: draft.selectedVerse
      }
      return
    }
    case SET_VERSION: {
      draft.selectedVersion = action.version
      return
    }
    case ADD_HIGHLIGHTED_VERSE: {
      draft.selectedVerses = {
        ...draft.selectedVerses,
        [action.id]: true
      }
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
      if (draft.selectedBook.Numero === 1 && draft.selectedChapter === 1) return

      const currentChapter = draft.selectedChapter

      if (currentChapter === 1) {
        const currentBook = draft.selectedBook
        const currentBookIndex = books.findIndex(b => b.Numero === currentBook.Numero)

        const prevBook = books[currentBookIndex - 1]
        draft.selectedBook = prevBook
        draft.selectedChapter = prevBook.Chapitres
        draft.selectedVerse = 1
        draft.temp = {
          selectedBook: prevBook,
          selectedChapter: prevBook.Chapitres,
          selectedVerse: 1
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
        const currentBookIndex = books.findIndex(b => b.Numero === currentBook.Numero)

        const nextBook = books[currentBookIndex + 1]

        draft.selectedBook = nextBook
        draft.selectedChapter = 1
        draft.selectedVerse = 1
        draft.temp = {
          selectedBook: nextBook,
          selectedChapter: 1,
          selectedVerse: 1
        }

        return
      }

      draft.selectedChapter = currentChapter + 1
      draft.selectedVerse = 1
      draft.temp.selectedChapter = currentChapter + 1
      draft.temp.selectedVerse = 1

      return
    }
    case SET_DICTIONNAIRE_DATABASE_HASH: {
      draft.dictionnaireDatabaseHash = action.hash
      return
    }
    case SET_STRONG_DATABASE_HASH: {
      draft.strongDatabaseHash = action.hash
      break
    }
    default: {
      break
    }
  }
}, initialState)

export function setStrongDatabaseHash(hash) {
  return {
    type: SET_STRONG_DATABASE_HASH,
    hash
  }
}

export function setDictionnaireDatabaseHash(hash) {
  return { type: SET_DICTIONNAIRE_DATABASE_HASH, hash }
}

export function setTempSelectedBook(book) {
  return {
    type: SET_TEMP_SELECTED_BOOK,
    book
  }
}

export function setTempSelectedChapter(chapter) {
  return {
    type: SET_TEMP_SELECTED_CHAPTER,
    chapter
  }
}

export function setTempSelectedVerse(verse) {
  return {
    type: SET_TEMP_SELECTED_VERSE,
    verse
  }
}

export function setSelectedVerse(verse) {
  return {
    type: SET_SELECTED_VERSE,
    verse
  }
}

export function validateSelected() {
  return {
    type: VALIDATE_SELECTED
  }
}

export function setAllAndValidateSelected(selected) {
  return {
    type: SET_ALL_AND_VALIDATE_SELECTED,
    selected
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
    type: RESET_TEMP_SELECTED
  }
}

export function setVersion(version) {
  if (!__DEV__) {
    Analytics.hit(event('Bible', 'version', version))
  }
  return {
    type: SET_VERSION,
    version
  }
}

export function goToPrevChapter() {
  return {
    type: GO_TO_PREV_CHAPTER
  }
}

export function goToNextChapter() {
  return {
    type: GO_TO_NEXT_CHAPTER
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
    id
  }
}

export function removeSelectedVerse(id) {
  return {
    type: REMOVE_HIGHLIGHTED_VERSE,
    id
  }
}

export function clearSelectedVerses() {
  return {
    type: CLEAR_HIGHLIGHTED_VERSES
  }
}

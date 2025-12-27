import produce from 'immer'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { atom, PrimitiveAtom } from 'jotai/vanilla'
import { atomWithDefault, splitAtom } from 'jotai/vanilla/utils'

import books, { Book } from '~assets/bible_versions/books-desc'
import { StrongReference, StudyNavigateBibleType, VerseIds } from '~common/types'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { versions } from '~helpers/bibleVersions'
import i18n, { getLangIsFr } from '~i18n'

export type TabBase = {
  id: string
  title: string
  isRemovable: boolean
  hasBackButton?: boolean
  base64Preview?: string
}

export type VersionCode = keyof typeof versions
export type BookName = (typeof books)[number]['Nom']
export type SelectedVerses = VerseIds
export interface BibleTab extends TabBase {
  type: 'bible'
  data: {
    selectedVersion: VersionCode
    selectedBook: Book
    selectedChapter: number
    selectedVerse: number
    parallelVersions: VersionCode[]
    temp: {
      selectedBook: Book
      selectedChapter: number
      selectedVerse: number
    }
    selectedVerses: SelectedVerses
    selectionMode: 'grid' | 'list'
    focusVerses?: (string | number)[]
    isSelectionMode: StudyNavigateBibleType | undefined
    isReadOnly: boolean
  }
}

export interface SearchTab extends TabBase {
  type: 'search'
  data: {
    searchValue: string
    searchMode: 'online' | 'offline'
  }
}

export interface CompareTab extends TabBase {
  type: 'compare'
  data: {
    selectedVerses: SelectedVerses
  }
}

export interface StrongTab extends TabBase {
  type: 'strong'
  data:
    | {
        book: number
        reference: string
      }
    | {
        book: number
        strongReference: StrongReference
      }
}

export interface StrongsTab extends TabBase {
  type: 'strongs'
  data: {}
}

export interface NavesTab extends TabBase {
  type: 'naves'
  data: {}
}

export interface DictionariesTab extends TabBase {
  type: 'dictionaries'
  data: {}
}

export interface NaveTab extends TabBase {
  type: 'nave'
  data: {
    name_lower: string
    name?: string
  }
}

export interface DictionaryTab extends TabBase {
  type: 'dictionary'
  data: {
    word: string
  }
}

export interface StudyTab extends TabBase {
  type: 'study'
  data: {
    studyId?: string
  }
}

export interface NotesTab extends TabBase {
  type: 'notes'
  data: {
    noteId?: string // undefined = list, defined = detail
  }
}

export interface NewTab extends TabBase {
  type: 'new'
  data: {}
}

export interface CommentaryTab extends TabBase {
  type: 'commentary'
  data: {
    verse: string
  }
}

export type TabItem =
  | BibleTab
  | SearchTab
  | CompareTab
  | StrongTab
  | StrongsTab
  | NavesTab
  | DictionariesTab
  | NaveTab
  | DictionaryTab
  | StudyTab
  | NotesTab
  | CommentaryTab
  | NewTab

export const tabTypes = [
  'bible',
  'search',
  'compare',
  'study',
  'notes',
  'strongs',
  'naves',
  'dictionaries',
  'commentary',
] as const

export const getDefaultBibleTab = (version?: VersionCode): BibleTab => ({
  id: `bible-${Date.now()}`,
  isRemovable: true,
  title: 'Genèse 1:1',
  type: 'bible',
  data: {
    selectedVersion: version || (getLangIsFr() ? 'LSG' : 'KJV'),
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
    focusVerses: undefined,
    isSelectionMode: undefined,
    isReadOnly: false,
  },
})

export const getDefaultData = <T extends TabItem>(
  type: TabItem['type']
): { title?: TabItem['title']; data: T['data'] } => {
  switch (type) {
    case 'bible': {
      return { data: getDefaultBibleTab().data }
    }
    case 'search': {
      return {
        data: {
          searchValue: '',
          searchMode: 'online',
        },
      }
    }
    case 'compare': {
      return {
        data: {
          selectedVerses: {
            '1-1-1': true,
          },
        },
      }
    }
    case 'strongs': {
      return {
        title: i18n.t('Lexique'),
        data: {},
      }
    }
    case 'strong': {
      return {
        data: {
          book: 1,
          reference: '1',
        },
      }
    }
    case 'nave': {
      return {
        data: {
          name_lower: 'aaron',
        },
      }
    }
    case 'naves': {
      return {
        title: i18n.t('Thèmes Nave'),
        data: {},
      }
    }
    case 'dictionary': {
      return {
        data: {
          word: 'aaron',
        },
      }
    }
    case 'dictionaries': {
      return {
        title: i18n.t('Dictionnaire'),
        data: {},
      }
    }
    case 'study': {
      return {
        title: i18n.t('Études'),
        data: {},
      }
    }
    case 'notes': {
      return {
        title: i18n.t('Notes'),
        data: {},
      }
    }
    case 'commentary': {
      return {
        data: {
          verse: '1-1-1',
        },
      }
    }
    default: {
      return { data: {} }
    }
  }
}

const maxCachedTabs = 5

export const activeTabIndexAtomOriginal = atomWithAsyncStorage<number>(
  'activeTabIndexAtomOriginal',
  0
)

// Migration function to make all existing tabs removable
const migrateTabsToRemovable = (tabs: TabItem[]): TabItem[] => {
  return tabs.map(tab => {
    const needsIdMigration = tab.id === 'bible'
    const needsRemovableMigration = tab.isRemovable === false

    if (needsIdMigration || needsRemovableMigration) {
      return {
        ...tab,
        id: needsIdMigration
          ? `bible-${Date.now()}-${Math.random().toString(36).slice(2)}`
          : tab.id,
        isRemovable: true,
      }
    }
    return tab
  })
}

export const tabsAtom = atomWithAsyncStorage<TabItem[]>('tabsAtom', [getDefaultBibleTab()], {
  migrate: migrateTabsToRemovable,
})

export const activeTabIndexAtom = atom(
  get => {
    const tabsAtoms = get(tabsAtomsAtom)
    if (
      (get(activeTabIndexAtomOriginal) !== 0 && tabsAtoms.length === 1) ||
      get(activeTabIndexAtomOriginal) > tabsAtoms.length - 1
    ) {
      return 0
    }
    return get(activeTabIndexAtomOriginal)
  },
  (get, set, value: number) => {
    set(activeTabIndexAtomOriginal, value)

    if (value !== -1) {
      const tabsAtoms = get(tabsAtomsAtom)
      if (value >= 0 && value < tabsAtoms.length) {
        const atomId = tabsAtoms[value].toString()

        const cachedTabIds = get(cachedTabIdsAtom)
        if (!cachedTabIds.includes(atomId)) {
          set(cachedTabIdsAtom, [atomId, ...cachedTabIds].slice(0, maxCachedTabs))
        }
      }
    }
  }
)

export const activeAtomIdAtom = atom(get => {
  const tabsAtoms = get(tabsAtomsAtom)
  const activeTabIndex = get(activeTabIndexAtom)

  if (activeTabIndex < 0 || activeTabIndex >= tabsAtoms.length) {
    return ''
  }

  const atomId = tabsAtoms[activeTabIndex].toString()
  return atomId
})

export const useIsCurrentTab = () => {
  const activeAtomId = useAtomValue(activeAtomIdAtom)

  return <T>(at: PrimitiveAtom<T>) => {
    return activeAtomId === at.toString()
  }
}

export const useFindTabIndex = (atomId: string) => {
  const tabsAtoms = useAtomValue(tabsAtomsAtom)

  return tabsAtoms.findIndex(tab => tab.toString() === atomId)
}

export const tabsAtomsAtom = splitAtom(tabsAtom, tab => tab.id)
export const tabsCountAtom = atom(get => get(tabsAtom).length)

export const cachedTabIdsAtom = atomWithDefault<string[]>(get => {
  const activeTabIndex = get(activeTabIndexAtom)

  if (activeTabIndex === -1) {
    return []
  }

  const tabsAtoms = get(tabsAtomsAtom)

  if (tabsAtoms.length === 0) {
    return []
  }

  if (activeTabIndex >= tabsAtoms.length) {
    // Fallback to first tab if index is out of bounds
    return tabsAtoms.length > 0 ? [tabsAtoms[0].toString()] : []
  }

  // Cache only the active tab (no special treatment for first tab)
  return [tabsAtoms[activeTabIndex].toString()]
})

export const checkTabType = <Type extends TabItem>(
  tab: TabItem | undefined,
  type: TabItem['type']
): tab is Type => {
  return tab?.type === type
}

export type BibleTabActions = ReturnType<typeof useBibleTabActions>

export const useBibleTabActions = (tabAtom: PrimitiveAtom<BibleTab>) => {
  const setBibleTab = useSetAtom(tabAtom)

  const setSelectedVersion = (selectedVersion: VersionCode) =>
    setBibleTab(
      produce(draft => {
        draft.data.selectedVersion = selectedVersion
      })
    )

  const setSelectedBook = (selectedBook: Book) =>
    setBibleTab(
      produce(draft => {
        draft.data.selectedBook = selectedBook
      })
    )

  const setSelectedChapter = (selectedChapter: number) =>
    setBibleTab(
      produce(draft => {
        draft.data.selectedChapter = selectedChapter
      })
    )

  const setSelectedVerse = (selectedVerse: number) =>
    setBibleTab(
      produce(draft => {
        draft.data.selectedVerse = selectedVerse
      })
    )

  const addParallelVersion = () =>
    setBibleTab(
      produce(draft => {
        draft.data.parallelVersions.push(getLangIsFr() ? 'LSG' : 'KJV')
      })
    )

  const setParallelVersion = (version: VersionCode, index: number) =>
    setBibleTab(
      produce(draft => {
        draft.data.parallelVersions[index] = version
      })
    )

  const removeParallelVersion = (index: number) =>
    setBibleTab(
      produce(draft => {
        draft.data.parallelVersions = draft.data.parallelVersions.filter((p, i) => i !== index)
      })
    )

  const removeAllParallelVersions = () =>
    setBibleTab(
      produce(draft => {
        draft.data.parallelVersions = []
      })
    )

  const setTempSelectedBook = (selectedBook: Book) =>
    setBibleTab(
      produce(draft => {
        draft.data.temp.selectedBook = selectedBook
      })
    )

  const setTempSelectedChapter = (selectedChapter: number) =>
    setBibleTab(
      produce(draft => {
        draft.data.temp.selectedChapter = selectedChapter
      })
    )

  const setTempSelectedVerse = (selectedVerse: number) =>
    setBibleTab(
      produce(draft => {
        draft.data.temp.selectedVerse = selectedVerse
      })
    )

  const resetTempSelected = () =>
    setBibleTab(
      produce(draft => {
        draft.data.temp.selectedBook = draft.data.selectedBook
        draft.data.temp.selectedChapter = draft.data.selectedChapter
        draft.data.temp.selectedVerse = draft.data.selectedVerse
      })
    )

  const validateTempSelected = () =>
    setBibleTab(
      produce(draft => {
        draft.data.selectedBook = draft.data.temp.selectedBook
        draft.data.selectedChapter = draft.data.temp.selectedChapter
        draft.data.selectedVerse = draft.data.temp.selectedVerse
      })
    )

  const toggleSelectionMode = () =>
    setBibleTab(
      produce(draft => {
        draft.data.selectionMode = draft.data.selectionMode === 'grid' ? 'list' : 'grid'
      })
    )

  const selectAllVerses = (ids: VerseIds) => {
    setBibleTab(
      produce(draft => {
        draft.data.selectedVerses = ids
      })
    )
  }

  const addSelectedVerse = (id: string) => {
    setBibleTab(
      produce(draft => {
        draft.data.selectedVerses[id] = true
      })
    )
  }

  const removeSelectedVerse = (id: string) => {
    setBibleTab(
      produce(draft => {
        delete draft.data.selectedVerses[id]
      })
    )
  }

  const selectSelectedVerse = (id: string) => {
    setBibleTab(
      produce(draft => {
        draft.data.selectedVerses = {
          [id]: true,
        }
      })
    )
  }

  const setTitle = (title: string) => {
    setBibleTab(
      produce(draft => {
        draft.title = title
      })
    )
  }

  const clearSelectedVerses = () => {
    setBibleTab(
      produce(draft => {
        draft.data.selectedVerses = {}
      })
    )
  }

  const goToPrevChapter = () => {
    setBibleTab(
      produce(draft => {
        if (draft.data.selectedBook.Numero === 1 && draft.data.selectedChapter === 1) {
          return
        }

        const currentChapter = draft.data.selectedChapter

        if (currentChapter === 1) {
          const currentBook = draft.data.selectedBook
          const currentBookIndex = books.findIndex(b => b.Numero === currentBook.Numero)

          const prevBook = books[currentBookIndex - 1]
          draft.data.selectedBook = prevBook
          draft.data.selectedChapter = prevBook.Chapitres
          draft.data.selectedVerse = 1
          draft.data.temp = {
            selectedBook: prevBook,
            selectedChapter: prevBook.Chapitres,
            selectedVerse: 1,
          }

          return
        }

        draft.data.selectedChapter = currentChapter - 1
        draft.data.selectedVerse = 1
        draft.data.focusVerses = undefined
        draft.data.temp.selectedChapter = currentChapter - 1
        draft.data.temp.selectedVerse = 1

        return
      })
    )
  }

  const goToNextChapter = () => {
    setBibleTab(
      produce(draft => {
        if (
          draft.data.selectedBook.Numero === 66 &&
          draft.data.selectedChapter === draft.data.selectedBook.Chapitres
        ) {
          return
        }

        const currentChapter = draft.data.selectedChapter
        const currentBook = draft.data.selectedBook

        if (currentChapter === currentBook.Chapitres) {
          const currentBookIndex = books.findIndex(b => b.Numero === currentBook.Numero)

          const nextBook = books[currentBookIndex + 1]

          draft.data.selectedBook = nextBook
          draft.data.selectedChapter = 1
          draft.data.selectedVerse = 1
          draft.data.temp = {
            selectedBook: nextBook,
            selectedChapter: 1,
            selectedVerse: 1,
          }

          return
        }

        draft.data.selectedChapter = currentChapter + 1
        draft.data.selectedVerse = 1
        draft.data.focusVerses = undefined
        draft.data.temp.selectedChapter = currentChapter + 1
        draft.data.temp.selectedVerse = 1

        return
      })
    )
  }

  const goToChapter = ({ book, chapter }: { book: Book; chapter: number }) => {
    setBibleTab(
      produce(draft => {
        draft.data.selectedBook = book
        draft.data.selectedChapter = chapter
        draft.data.selectedVerse = 1
        draft.data.temp = {
          selectedBook: book,
          selectedChapter: 1,
          selectedVerse: 1,
        }
      })
    )
  }

  const setAllAndValidateSelected = (selected: {
    book: Book
    chapter: number
    verse: number
    version: VersionCode
  }) => {
    setBibleTab(
      produce(draft => {
        draft.data.temp = {
          selectedBook: selected.book,
          selectedChapter: selected.chapter,
          selectedVerse: selected.verse,
        }
        draft.data.selectedVersion = selected.version
        draft.data.selectedBook = selected.book
        draft.data.selectedChapter = selected.chapter
        draft.data.selectedVerse = selected.verse
      })
    )
  }

  return {
    setSelectedVersion,
    setSelectedBook,
    setSelectedChapter,
    setSelectedVerse,

    addParallelVersion,
    removeParallelVersion,
    removeAllParallelVersions,
    setParallelVersion,

    setTempSelectedBook,
    setTempSelectedChapter,
    setTempSelectedVerse,
    resetTempSelected,
    validateTempSelected,

    toggleSelectionMode,

    selectAllVerses,
    addSelectedVerse,
    removeSelectedVerse,
    clearSelectedVerses,
    selectSelectedVerse,

    goToNextChapter,
    goToPrevChapter,
    goToChapter,

    setAllAndValidateSelected,
    setTitle,
  }
}

export type AppSwitcherMode = 'list' | 'view'
export const appSwitcherModeAtom = atom<AppSwitcherMode>('view')

import produce from 'immer'
import { atom, PrimitiveAtom, useAtom } from 'jotai'
import { splitAtom } from 'jotai/utils'
import { RefObject, useCallback, useMemo } from 'react'
import { View } from 'react-native'
import Animated from 'react-native-reanimated'
import { captureRef } from 'react-native-view-shot'

import books, { Book } from '~assets/bible_versions/books-desc'
import { StrongReference } from '~common/types'
import { versions } from '~helpers/bibleVersions'
import { getLangIsFr } from '~i18n'

export type TabBase = {
  id: string
  title: string
  isRemovable: boolean
  hasBackButton?: boolean
  base64Preview?: string
}

export type VersionCode = keyof typeof versions
export type BookName = typeof books[number]['Nom']
export type SelectedVerses = { [verse: string]: true }
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
    focusVerses?: string[]
    isSelectionMode: boolean
    isReadOnly: boolean
  }
}

export interface SearchTab extends TabBase {
  type: 'search'
  data: {
    searchValue: string
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
  data: {}
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
  | NaveTab
  | DictionaryTab
  | StudyTab
  | CommentaryTab
  | NewTab

export type TabProperties = {
  x: Animated.SharedValue<number>
  y: Animated.SharedValue<number>
  animationProgress: Animated.SharedValue<number>
}

export type BibleTabProps = {}

export const defaultBibleTab: BibleTab = {
  id: 'bible',
  isRemovable: false,
  title: 'Genèse 1:1',
  type: 'bible',
  data: {
    selectedVersion: getLangIsFr() ? 'LSG' : 'KJV',
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
    isSelectionMode: false,
    isReadOnly: false,
  },
}

// const storage = { ...createJSONStorage(() => AsyncStorage), delayInit: true }

// export const tabsAtom = atomWithStorage<TabItem[]>(
//   'tabsAtom',
//   [defaultBibleTab],
//   storage as any
// )

export const activeTabIndexAtom = atom<number | undefined>(0)

export const tabsAtom = atom<TabItem[]>([
  defaultBibleTab,
  {
    id: `compare-${Date.now()}`,
    title: 'Comparer',
    isRemovable: true,
    type: 'compare',
    data: {
      selectedVerses: {
        '1-1-1': true,
      },
    },
  },
  {
    id: `strong-${Date.now()}`,
    title: 'Lexique',
    isRemovable: true,
    type: 'strong',
    data: {
      book: 40,
      reference: '1594',
    },
  },
  {
    id: `nave-${Date.now()}`,
    title: 'Nave',
    isRemovable: true,
    type: 'nave',
    data: {
      name: 'Abaddon',
      name_lower: 'abaddon',
    },
  },
  {
    id: `dictionary-${Date.now()}`,
    title: 'Dictionary',
    isRemovable: true,
    type: 'dictionary',
    data: {
      word: 'abaddon',
    },
  },
  {
    id: `commentary-${Date.now()}`,
    title: 'Commentaire',
    isRemovable: true,
    type: 'commentary',
    data: {
      verse: '1-1-1',
    },
  },
  {
    id: `search-${Date.now()}`,
    title: 'Recherche',
    isRemovable: true,
    type: 'search',
    data: {
      searchValue: 'Salut',
    },
  },
])

export const tabsAtomsAtom = splitAtom(tabsAtom, tab => tab.id)
export const tabsCountAtom = atom(get => get(tabsAtom).length)

export const checkTabType = <Type extends TabItem>(
  tab: TabItem | undefined,
  type: TabItem['type']
): tab is Type => {
  return tab?.type === type
}

export const useGetDefaultBibleTabAtom = () => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const [defaultBibleTabAtom] = tabsAtoms

  return defaultBibleTabAtom as PrimitiveAtom<BibleTab>
}

export const useBibleTabActions = (tabAtom: PrimitiveAtom<BibleTab>) => {
  const [bibleTab, setBibleTab] = useAtom(tabAtom)

  if (!checkTabType<BibleTab>(bibleTab, 'bible')) {
    throw new Error('Invalid tab type')
  }

  const setSelectedVersion = useCallback(
    (selectedVersion: VersionCode) =>
      setBibleTab(
        produce(draft => {
          draft.data.selectedVersion = selectedVersion
        })
      ),
    [setBibleTab]
  )

  const setSelectedBook = useCallback(
    (selectedBook: Book) =>
      setBibleTab(
        produce(draft => {
          draft.data.selectedBook = selectedBook
        })
      ),
    [setBibleTab]
  )

  const setSelectedChapter = useCallback(
    (selectedChapter: number) =>
      setBibleTab(
        produce(draft => {
          draft.data.selectedChapter = selectedChapter
        })
      ),
    [setBibleTab]
  )

  const setSelectedVerse = useCallback(
    (selectedVerse: number) =>
      setBibleTab(
        produce(draft => {
          draft.data.selectedVerse = selectedVerse
        })
      ),
    [setBibleTab]
  )

  const addParallelVersion = useCallback(
    () =>
      setBibleTab(
        produce(draft => {
          draft.data.parallelVersions.push(getLangIsFr() ? 'LSG' : 'KJV')
        })
      ),
    [setBibleTab]
  )

  const setParallelVersion = useCallback(
    (version: VersionCode, index: number) =>
      setBibleTab(
        produce(draft => {
          draft.data.parallelVersions[index] = version
        })
      ),
    [setBibleTab]
  )

  const removeParallelVersion = useCallback(
    (index: number) =>
      setBibleTab(
        produce(draft => {
          draft.data.parallelVersions = draft.data.parallelVersions.filter(
            (p, i) => i !== index
          )
        })
      ),
    [setBibleTab]
  )

  const removeAllParallelVersions = useCallback(
    () =>
      setBibleTab(
        produce(draft => {
          draft.data.parallelVersions = []
        })
      ),
    [setBibleTab]
  )

  const setTempSelectedBook = useCallback(
    (selectedBook: Book) =>
      setBibleTab(
        produce(draft => {
          draft.data.temp.selectedBook = selectedBook
        })
      ),
    [setBibleTab]
  )

  const setTempSelectedChapter = useCallback(
    (selectedChapter: number) =>
      setBibleTab(
        produce(draft => {
          draft.data.temp.selectedChapter = selectedChapter
        })
      ),
    [setBibleTab]
  )

  const setTempSelectedVerse = useCallback(
    (selectedVerse: number) =>
      setBibleTab(
        produce(draft => {
          draft.data.temp.selectedVerse = selectedVerse
        })
      ),
    [setBibleTab]
  )

  const resetTempSelected = useCallback(
    () =>
      setBibleTab(
        produce(draft => {
          draft.data.temp.selectedBook = draft.data.selectedBook
          draft.data.temp.selectedChapter = draft.data.selectedChapter
          draft.data.temp.selectedVerse = draft.data.selectedVerse
        })
      ),
    [setBibleTab]
  )

  const validateTempSelected = useCallback(
    () =>
      setBibleTab(
        produce(draft => {
          draft.data.selectedBook = draft.data.temp.selectedBook
          draft.data.selectedChapter = draft.data.temp.selectedChapter
          draft.data.selectedVerse = draft.data.temp.selectedVerse
        })
      ),
    [setBibleTab]
  )

  const toggleSelectionMode = useCallback(
    () =>
      setBibleTab(
        produce(draft => {
          draft.data.selectionMode =
            draft.data.selectionMode === 'grid' ? 'list' : 'grid'
        })
      ),
    [setBibleTab]
  )

  const selectAllVerses = useCallback(
    (ids: { [verse: string]: true }) => {
      setBibleTab(
        produce(draft => {
          draft.data.selectedVerses = ids
        })
      )
    },
    [setBibleTab]
  )

  const addSelectedVerse = useCallback(
    (id: string) => {
      setBibleTab(
        produce(draft => {
          draft.data.selectedVerses[id] = true
        })
      )
    },
    [setBibleTab]
  )

  const removeSelectedVerse = useCallback(
    (id: string) => {
      setBibleTab(
        produce(draft => {
          delete draft.data.selectedVerses[id]
        })
      )
    },
    [setBibleTab]
  )

  const setTitle = useCallback(
    (title: string) => {
      setBibleTab(
        produce(draft => {
          draft.title = title
        })
      )
    },
    [setBibleTab]
  )

  const clearSelectedVerses = useCallback(() => {
    setBibleTab(
      produce(draft => {
        draft.data.selectedVerses = {}
      })
    )
  }, [setBibleTab])

  const goToPrevChapter = useCallback(() => {
    setBibleTab(
      produce(draft => {
        if (
          draft.data.selectedBook.Numero === 1 &&
          draft.data.selectedChapter === 1
        ) {
          return
        }

        const currentChapter = draft.data.selectedChapter

        if (currentChapter === 1) {
          const currentBook = draft.data.selectedBook
          const currentBookIndex = books.findIndex(
            b => b.Numero === currentBook.Numero
          )

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
        draft.data.temp.selectedChapter = currentChapter - 1
        draft.data.temp.selectedVerse = 1

        return
      })
    )
  }, [setBibleTab])

  const goToNextChapter = useCallback(() => {
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
          const currentBookIndex = books.findIndex(
            b => b.Numero === currentBook.Numero
          )

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
        draft.data.temp.selectedChapter = currentChapter + 1
        draft.data.temp.selectedVerse = 1

        return
      })
    )
  }, [setBibleTab])

  const setAllAndValidateSelected = useCallback(
    (selected: {
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
    },
    [setBibleTab]
  )

  const actions = useMemo(
    () => ({
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

      goToNextChapter,
      goToPrevChapter,

      setAllAndValidateSelected,
      setTitle,
    }),
    []
  )

  return [bibleTab, actions] as [BibleTab, typeof actions]
}

export type AppSwitcherMode = 'list' | 'view'
export const appSwitcherModeAtom = atom<AppSwitcherMode>('view')

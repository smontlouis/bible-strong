import produce from 'immer'
import { atom, PrimitiveAtom, useAtom } from 'jotai'
import { atomWithDefault, loadable, splitAtom } from 'jotai/utils'
import { useCallback, useMemo } from 'react'

import books, { Book } from '~assets/bible_versions/books-desc'
import { StrongReference } from '~common/types'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
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

export const tabTypes = [
  'bible',
  'search',
  'compare',
  'study',
  'strong',
  'nave',
  'dictionary',
  'commentary',
] as const

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

export const getDefaultData = <T extends TabItem>(type: TabItem['type']) => {
  switch (type) {
    case 'bible': {
      return defaultBibleTab.data as T['data']
    }
    case 'search': {
      return {
        searchValue: '',
      } as T['data']
    }
    case 'compare': {
      return {
        selectedVerses: {
          '1-1-1': true,
        },
      } as T['data']
    }
    case 'strong': {
      return {
        book: 1,
        reference: '1',
      } as T['data']
    }
    case 'nave': {
      return {
        name_lower: 'aaron',
      } as T['data']
    }
    case 'dictionary': {
      return {
        word: 'aaron',
      } as T['data']
    }
    case 'study': {
      return {} as T['data']
    }
    case 'commentary': {
      return {
        verse: '1-1-1',
      } as T['data']
    }
  }
}

const maxCachedTabs = 5

export const activeTabIndexAtomOriginal = atomWithAsyncStorage<number>(
  'activeTabIndexAtomOriginal',
  0
)
export const tabsAtom = atomWithAsyncStorage<TabItem[]>('tabsAtom', [
  defaultBibleTab,
])
export const loadableActiveIndexAtom = loadable(activeTabIndexAtomOriginal)
export const loadableTabsAtom = loadable(tabsAtom)

export const activeTabIndexAtom = atom(
  get => get(activeTabIndexAtomOriginal),
  (get, set, value: number) => {
    set(activeTabIndexAtomOriginal, value)

    if (value !== -1) {
      const tabsAtoms = get(tabsAtomsAtom)
      const atomId = tabsAtoms[value].toString()

      const cachedTabIds = get(cachedTabIdsAtom)
      if (!cachedTabIds.includes(atomId)) {
        set(cachedTabIdsAtom, [atomId, ...cachedTabIds].slice(0, maxCachedTabs))
      }
    }
  }
)

export const tabsAtomsAtom = splitAtom(tabsAtom, tab => tab.id)
export const tabsCountAtom = atom(get => get(tabsAtom).length)

export const cachedTabIdsAtom = atomWithDefault<string[]>(get => {
  const activeTabIndex = get(activeTabIndexAtom)
  if (activeTabIndex === -1) {
    return []
  }
  const tabsAtoms = get(tabsAtomsAtom)

  // If activeTab is bible tab, only cache it
  if (activeTabIndex === 0) {
    return [tabsAtoms[0].toString()]
  }
  // Cache the first tab (bible) and the active tab
  return [tabsAtoms[0].toString(), tabsAtoms[activeTabIndex].toString()]
})

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

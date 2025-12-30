import produce from 'immer'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { atom, PrimitiveAtom } from 'jotai/vanilla'
import { atomWithDefault, splitAtom } from 'jotai/vanilla/utils'

import books, { Book } from '~assets/bible_versions/books-desc'
import { StrongReference, StudyNavigateBibleType, VerseIds } from '~common/types'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { storage } from '~helpers/storage'
import { versions } from '~helpers/bibleVersions'
import i18n, { getLangIsFr } from '~i18n'

// ============================================================================
// TAB TYPES
// ============================================================================

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
  data: {
    book?: number
    reference?: string
    strongReference?: StrongReference
  }
}

export interface NaveTab extends TabBase {
  type: 'nave'
  data: {
    name_lower?: string
    name?: string
  }
}

export interface DictionaryTab extends TabBase {
  type: 'dictionary'
  data: {
    word?: string
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
  'strong',
  'nave',
  'dictionary',
  'commentary',
] as const

// ============================================================================
// TAB GROUP TYPES
// ============================================================================

export const GROUP_COLORS = [
  '#636e72', // Grey
  '#81ecec', // Cyan
  '#74b9ff', // Bleu
  '#a29bfe', // Violet
  '#fd79a8', // Rose
  '#ff7675', // Rouge
  '#fdcb6e', // Jaune
  '#55efc4', // Vert menthe
  '#ffeaa7', // Jaune pâle
] as const

export type GroupColor = (typeof GROUP_COLORS)[number]

export interface TabGroup {
  id: string
  name: string
  color?: string
  isDefault: boolean
  tabs: TabItem[]
  activeTabIndex: number
  createdAt: number
}

export const MAX_TAB_GROUPS = 8
export const DEFAULT_GROUP_ID = 'default-group'

// ============================================================================
// DEFAULT FACTORIES
// ============================================================================

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

export const createDefaultGroup = (version?: VersionCode): TabGroup => ({
  id: DEFAULT_GROUP_ID,
  name: i18n.t('Principal'),
  isDefault: true,
  tabs: [getDefaultBibleTab(version)],
  activeTabIndex: 0,
  createdAt: 0,
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
    case 'strong': {
      return {
        title: i18n.t('Lexique'),
        data: {},
      }
    }
    case 'nave': {
      return {
        title: i18n.t('Thèmes Nave'),
        data: {},
      }
    }
    case 'dictionary': {
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

// ============================================================================
// MIGRATIONS
// ============================================================================

// Migration function to convert old tab types to unified types
const migrateTabTypes = (tab: TabItem): TabItem => {
  // Migrate old plural types to unified singular types with empty data
  const tabType = tab.type as string
  if (tabType === 'strongs') {
    return {
      ...tab,
      type: 'strong',
      data: {},
    } as StrongTab
  }
  if (tabType === 'naves') {
    return {
      ...tab,
      type: 'nave',
      data: {},
    } as NaveTab
  }
  if (tabType === 'dictionaries') {
    return {
      ...tab,
      type: 'dictionary',
      data: {},
    } as DictionaryTab
  }
  return tab
}

// Migration function to make all existing tabs removable
const migrateTabsToRemovable = (tabs: TabItem[]): TabItem[] => {
  return tabs.map(tab => {
    // First migrate old tab types
    tab = migrateTabTypes(tab)

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

// Migration function for tab groups
const migrateTabGroups = (groups: TabGroup[]): TabGroup[] => {
  // If valid tab groups structure exists (even if empty), just apply tab migrations
  if (groups.length > 0 && groups[0].tabs !== undefined) {
    // Check if this is just the default initial data (single group with single default bible tab)
    const firstTab = groups[0].tabs[0]
    const isDefaultInitialData =
      groups.length === 1 &&
      groups[0].id === DEFAULT_GROUP_ID &&
      groups[0].tabs.length === 1 &&
      firstTab?.type === 'bible' &&
      firstTab?.id?.startsWith('bible-')

    // If not default initial data, keep the existing groups (even if empty)
    if (!isDefaultInitialData) {
      return groups.map(group => ({
        ...group,
        tabs: migrateTabsToRemovable(group.tabs),
      }))
    }
  }

  // Try to migrate from old tabsAtom storage key
  try {
    const oldTabsJson = storage.getString('tabsAtom')
    const oldActiveIndexJson = storage.getString('activeTabIndexAtomOriginal')

    if (oldTabsJson) {
      const oldTabs = JSON.parse(oldTabsJson) as TabItem[]
      if (oldTabs.length > 0) {
        const activeIndex = oldActiveIndexJson ? JSON.parse(oldActiveIndexJson) : 0

        console.log('[TabGroups] Migrating', oldTabs.length, 'tabs from old storage')

        // Delete old storage keys after successful migration
        storage.remove('tabsAtom')
        storage.remove('activeTabIndexAtomOriginal')

        return [
          {
            id: DEFAULT_GROUP_ID,
            name: i18n.t('Principal'),
            isDefault: true,
            tabs: migrateTabsToRemovable(oldTabs),
            activeTabIndex: Math.min(activeIndex, oldTabs.length - 1),
            createdAt: 0,
          },
        ]
      }
    }
  } catch (e) {
    console.error('[TabGroups] Migration from old storage failed:', e)
  }

  // Fallback: create default group
  return [createDefaultGroup()]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const maxCachedTabs = 5

// ============================================================================
// CORE GROUP ATOMS
// ============================================================================

// Main groups atom with persistence
export const tabGroupsAtom = atomWithAsyncStorage<TabGroup[]>(
  'tabGroupsAtom',
  [createDefaultGroup()],
  { migrate: migrateTabGroups }
)

// Active group ID (persisted)
export const activeGroupIdAtom = atomWithAsyncStorage<string>('activeGroupIdAtom', DEFAULT_GROUP_ID)

// Get current active group (derived)
export const activeGroupAtom = atom(get => {
  const groups = get(tabGroupsAtom)
  const activeId = get(activeGroupIdAtom)
  return groups.find(g => g.id === activeId) || groups[0]
})

// Number of groups
export const groupsCountAtom = atom(get => get(tabGroupsAtom).length)

// ============================================================================
// BACKWARD COMPATIBLE ATOMS (for existing consumers)
// ============================================================================

// Get/set tabs for current group - this replaces the old tabsAtom
// Supports both direct values and updater functions for backward compatibility
export const tabsAtom = atom(
  get => {
    const activeGroup = get(activeGroupAtom)
    return activeGroup.tabs
  },
  (get, set, newTabsOrUpdater: TabItem[] | ((prev: TabItem[]) => TabItem[])) => {
    const groups = get(tabGroupsAtom)
    const activeId = get(activeGroupIdAtom)
    const currentTabs = get(activeGroupAtom).tabs

    // Support updater function pattern: setTabs(prev => [...prev, newTab])
    const newTabs =
      typeof newTabsOrUpdater === 'function' ? newTabsOrUpdater(currentTabs) : newTabsOrUpdater

    set(
      tabGroupsAtom,
      groups.map(g => (g.id === activeId ? { ...g, tabs: newTabs } : g))
    )
  }
)

// Split atom for fine-grained tab updates
export const tabsAtomsAtom = splitAtom(tabsAtom, tab => tab.id)

// Number of tabs in current group
export const tabsCountAtom = atom(get => get(tabsAtom).length)

// Legacy atom - kept for compatibility but no longer used directly
export const activeTabIndexAtomOriginal = atomWithAsyncStorage<number>(
  'activeTabIndexAtomOriginal',
  0
)

// Active tab index - now stored in the group
export const activeTabIndexAtom = atom(
  get => {
    const activeGroup = get(activeGroupAtom)
    const tabsAtoms = get(tabsAtomsAtom)

    // Bounds checking
    if (activeGroup.activeTabIndex >= tabsAtoms.length) {
      return Math.max(0, tabsAtoms.length - 1)
    }
    if (activeGroup.activeTabIndex < 0) {
      return 0
    }
    return activeGroup.activeTabIndex
  },
  (get, set, value: number) => {
    const groups = get(tabGroupsAtom)
    const activeId = get(activeGroupIdAtom)

    // Update the active tab index in the group
    set(
      tabGroupsAtom,
      groups.map(g => (g.id === activeId ? { ...g, activeTabIndex: value } : g))
    )

    // Update cache (existing logic)
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

// Active atom ID (derived)
export const activeAtomIdAtom = atom(get => {
  const tabsAtoms = get(tabsAtomsAtom)
  const activeTabIndex = get(activeTabIndexAtom)

  if (activeTabIndex < 0 || activeTabIndex >= tabsAtoms.length) {
    return ''
  }

  const atomId = tabsAtoms[activeTabIndex].toString()
  return atomId
})

// Cached tab IDs (global cache shared across all groups)
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

// ============================================================================
// UTILITY FUNCTIONS AND HOOKS
// ============================================================================

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

export const checkTabType = <Type extends TabItem>(
  tab: TabItem | undefined,
  type: TabItem['type']
): tab is Type => {
  return tab?.type === type
}

// ============================================================================
// BIBLE TAB ACTIONS
// ============================================================================

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

// ============================================================================
// TAB GROUP ACTIONS
// ============================================================================

/**
 * Close all tabs in the current group
 */
export const closeAllTabsAtom = atom(null, (get, set) => {
  const groups = get(tabGroupsAtom)
  const activeId = get(activeGroupIdAtom)

  set(
    tabGroupsAtom,
    groups.map(g => (g.id === activeId ? { ...g, tabs: [], activeTabIndex: 0 } : g))
  )
  set(cachedTabIdsAtom, [])
})

// ============================================================================
// APP SWITCHER MODE
// ============================================================================

export type AppSwitcherMode = 'list' | 'view'
export const appSwitcherModeAtom = atom<AppSwitcherMode>('view')

import * as Sentry from '@sentry/react-native'
import { getDefaultStore } from 'jotai/vanilla'
import { storage } from '~helpers/storage'
import {
  activeTabIndexAtomOriginal,
  getDefaultBibleTab,
  tabsAtom,
  type TabItem,
} from './tabs'

const TABS_STORAGE_KEY = 'tabsAtom'
const ACTIVE_INDEX_STORAGE_KEY = 'activeTabIndexAtomOriginal'

/**
 * Validates that the tabs data has the expected structure
 */
const validateTabsData = (tabs: unknown): tabs is TabItem[] => {
  if (!Array.isArray(tabs)) {
    return false
  }

  if (tabs.length === 0) {
    return false
  }

  // Check that each tab has required properties
  return tabs.every(
    (tab) =>
      typeof tab === 'object' &&
      tab !== null &&
      typeof tab.id === 'string' &&
      typeof tab.type === 'string'
  )
}

/**
 * Hydrates tabsAtom and activeTabIndexAtomOriginal from MMKV storage.
 *
 * This function should be called BEFORE any React component accesses these atoms
 * to ensure the persisted data is loaded correctly.
 *
 * The problem: Jotai's atomWithStorage with getOnInit can fail silently in some cases,
 * especially when accessed via getDefaultStore().get() before any component subscribes.
 *
 * This explicit hydration guarantees the atoms have the correct values from MMKV.
 */
export const hydrateTabsAtom = (): void => {
  const store = getDefaultStore()

  Sentry.addBreadcrumb({
    category: 'tabs',
    message: 'Starting tabs hydration from MMKV',
    level: 'info',
  })

  try {
    // Read tabs from MMKV
    const tabsJson = storage.getString(TABS_STORAGE_KEY)
    const activeIndexJson = storage.getString(ACTIVE_INDEX_STORAGE_KEY)

    Sentry.addBreadcrumb({
      category: 'tabs',
      message: 'MMKV read complete',
      level: 'info',
      data: {
        hasTabsData: !!tabsJson,
        tabsDataLength: tabsJson?.length ?? 0,
        hasActiveIndex: !!activeIndexJson,
      },
    })

    // Parse and validate tabs
    if (tabsJson) {
      try {
        const tabs = JSON.parse(tabsJson)

        if (validateTabsData(tabs)) {
          store.set(tabsAtom, tabs)

          Sentry.addBreadcrumb({
            category: 'tabs',
            message: 'Tabs hydrated successfully',
            level: 'info',
            data: {
              tabCount: tabs.length,
              tabTypes: tabs.map((t: TabItem) => t.type).join(', '),
            },
          })
        } else {
          // Data exists but is invalid
          Sentry.captureMessage('Invalid tabs data structure in MMKV', {
            level: 'warning',
            extra: {
              tabsJson: tabsJson.substring(0, 500), // Truncate for safety
              parsedType: typeof tabs,
              isArray: Array.isArray(tabs),
              length: Array.isArray(tabs) ? tabs.length : 'N/A',
            },
          })

          // Use default
          store.set(tabsAtom, [getDefaultBibleTab()])
        }
      } catch (parseError) {
        // JSON parse failed
        Sentry.captureException(parseError, {
          extra: {
            context: 'hydrateTabsAtom - JSON.parse failed',
            tabsJsonPreview: tabsJson.substring(0, 200),
          },
        })

        // Use default
        store.set(tabsAtom, [getDefaultBibleTab()])
      }
    } else {
      // No data in MMKV - this is normal for first launch
      Sentry.addBreadcrumb({
        category: 'tabs',
        message: 'No tabs data in MMKV, using default',
        level: 'info',
      })

      store.set(tabsAtom, [getDefaultBibleTab()])
    }

    // Parse and validate active index
    if (activeIndexJson) {
      try {
        const activeIndex = JSON.parse(activeIndexJson)

        if (typeof activeIndex === 'number' && activeIndex >= 0) {
          store.set(activeTabIndexAtomOriginal, activeIndex)

          Sentry.addBreadcrumb({
            category: 'tabs',
            message: 'Active tab index hydrated',
            level: 'info',
            data: { activeIndex },
          })
        } else {
          store.set(activeTabIndexAtomOriginal, 0)
        }
      } catch (parseError) {
        Sentry.captureException(parseError, {
          extra: {
            context: 'hydrateTabsAtom - activeIndex JSON.parse failed',
            activeIndexJson,
          },
        })
        store.set(activeTabIndexAtomOriginal, 0)
      }
    } else {
      store.set(activeTabIndexAtomOriginal, 0)
    }
  } catch (error) {
    // Unexpected error during hydration
    Sentry.captureException(error, {
      extra: {
        context: 'hydrateTabsAtom - unexpected error',
      },
    })

    // Fallback to defaults
    store.set(tabsAtom, [getDefaultBibleTab()])
    store.set(activeTabIndexAtomOriginal, 0)
  }
}

/**
 * Debug function to check current state of tabs storage
 * Can be called from dev menu or debug screen
 */
export const debugTabsStorage = (): {
  mmkvTabs: string | undefined
  mmkvActiveIndex: string | undefined
  storeTabs: TabItem[]
  storeActiveIndex: number
} => {
  const store = getDefaultStore()

  return {
    mmkvTabs: storage.getString(TABS_STORAGE_KEY),
    mmkvActiveIndex: storage.getString(ACTIVE_INDEX_STORAGE_KEY),
    storeTabs: store.get(tabsAtom),
    storeActiveIndex: store.get(activeTabIndexAtomOriginal),
  }
}

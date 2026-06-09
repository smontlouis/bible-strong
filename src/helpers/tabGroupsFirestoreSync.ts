import { TabGroup, TabItem } from '~state/tabs'
import { clampTabIndex } from '~state/tabWorkspace'
import {
  writeToSubcollection,
  deleteFromSubcollection,
  fetchSubcollection,
  subscribeToSubcollection,
  SubcollectionChangeCallback,
} from './firestoreSubcollections'
import { storage } from './storage'

const MIGRATION_KEY = 'tabGroups_migratedToFirestore'

// ============================================================================
// TYPES
// ============================================================================

/**
 * TabGroup structure for Firestore.
 *
 * `activeTabIndex` is intentionally local-only so each device can keep its own
 * active tab inside a synced group.
 */
export interface FirestoreTabGroup extends Omit<TabGroup, 'tabs' | 'activeTabIndex'> {
  tabs: FirestoreTabItem[]
}

/**
 * TabItem structure for Firestore (without base64Preview)
 */
type FirestoreTabItem = Omit<TabItem, 'base64Preview'>

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Recursively remove undefined values from an object
 * Firestore doesn't support undefined values
 */
function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item)) as T
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value)
      }
    }
    return cleaned as T
  }

  return obj
}

/**
 * Strip local-only fields from tab groups for Firestore storage
 * base64Preview is large (50-200KB) and can be regenerated locally
 * activeTabIndex is per-device UI state
 * Also removes all undefined values (Firestore doesn't support them)
 */
export function prepareTabGroupForSync(
  group: TabGroup,
  options?: { updatedAt?: number }
): FirestoreTabGroup {
  const { activeTabIndex, ...groupWithoutLocalState } = group
  const prepared = {
    ...groupWithoutLocalState,
    updatedAt: options?.updatedAt ?? group.updatedAt,
    tabs: group.tabs.map(tab => {
      const { base64Preview, ...tabWithoutPreview } = tab

      if (tabWithoutPreview.type === 'bible') {
        return {
          ...tabWithoutPreview,
          data: {
            ...tabWithoutPreview.data,
            selectedVerses: {},
          },
        } as FirestoreTabItem
      }

      return tabWithoutPreview as FirestoreTabItem
    }),
  }

  return removeUndefined(prepared)
}

function resolveLocalActiveTabIndex(remoteTabs: FirestoreTabItem[], localGroup?: TabGroup): number {
  if (!localGroup) {
    return 0
  }

  const localActiveTab = localGroup.tabs[localGroup.activeTabIndex]
  const activeTabId = localActiveTab?.id

  if (activeTabId) {
    const nextIndex = remoteTabs.findIndex(tab => tab.id === activeTabId)
    if (nextIndex !== -1) {
      return nextIndex
    }
  }

  return clampTabIndex(localGroup.activeTabIndex, remoteTabs.length)
}

/**
 * Transform Firestore data back to local TabGroup format
 * Preserves local-only state if available
 */
export function hydrateTabGroup(
  firestoreGroup: FirestoreTabGroup,
  localGroup?: TabGroup
): TabGroup {
  const tabs = firestoreGroup.tabs.map(firestoreTab => {
    // Try to preserve local base64Preview
    const localTab = localGroup?.tabs.find(t => t.id === firestoreTab.id)
    return {
      ...firestoreTab,
      base64Preview: localTab?.base64Preview,
    } as TabItem
  })

  return {
    ...firestoreGroup,
    tabs,
    activeTabIndex: resolveLocalActiveTabIndex(firestoreGroup.tabs, localGroup),
  }
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Sync a single tab group to Firestore
 */
export async function syncTabGroupToFirestore(userId: string, group: TabGroup): Promise<void> {
  const data = prepareTabGroupForSync(group, { updatedAt: Date.now() })
  await writeToSubcollection(userId, 'tabGroups', group.id, data)
}

/**
 * Delete a tab group from Firestore
 */
export async function deleteTabGroupFromFirestore(userId: string, groupId: string): Promise<void> {
  await deleteFromSubcollection(userId, 'tabGroups', groupId)
  console.log(`[TabGroupsSync] Deleted group ${groupId} from Firestore`)
}

/**
 * Fetch all tab groups from Firestore
 * Uses cache-first mode (onSnapshot) for instant response without blocking on network.
 *
 * @see https://github.com/invertase/react-native-firebase/issues/7610
 */
export async function fetchTabGroupsFromFirestore(userId: string): Promise<TabGroup[]> {
  const data = await fetchSubcollection(userId, 'tabGroups')

  if (!data || Object.keys(data).length === 0) {
    console.log('[TabGroupsSync] No groups found in Firestore')
    return []
  }

  const groups: TabGroup[] = Object.values(data).map(g => hydrateTabGroup(g as FirestoreTabGroup))

  // Sort by createdAt to maintain order
  groups.sort((a, b) => a.createdAt - b.createdAt)

  console.log(`[TabGroupsSync] Fetched ${groups.length} groups from Firestore`)
  return groups
}

/**
 * Subscribe to tab groups changes from Firestore
 */
export function subscribeToTabGroupsFirestore(
  userId: string,
  onChange: SubcollectionChangeCallback
): () => void {
  return subscribeToSubcollection(userId, 'tabGroups', onChange)
}

// ============================================================================
// MERGE / CONFLICT RESOLUTION
// ============================================================================

/**
 * Merge remote groups with local groups
 * Strategy: last-write-wins based on updatedAt
 * Preserves local base64Preview values
 */
export function mergeTabGroups(localGroups: TabGroup[], remoteGroups: TabGroup[]): TabGroup[] {
  const merged: TabGroup[] = []
  const localById = new Map(localGroups.map(g => [g.id, g]))
  const remoteById = new Map(remoteGroups.map(g => [g.id, g]))

  // All unique IDs
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])

  for (const id of allIds) {
    const local = localById.get(id)
    const remote = remoteById.get(id)

    if (!remote) {
      // Local only - keep it (will be synced to Firestore)
      if (local) {
        merged.push(local)
      }
    } else if (!local) {
      // Remote only - add it
      merged.push(remote)
    } else {
      // Both exist - last-write-wins based on updatedAt
      const remoteUpdatedAt = remote.updatedAt || remote.createdAt || 0
      const localUpdatedAt = local.updatedAt || local.createdAt || 0

      if (remoteUpdatedAt > localUpdatedAt) {
        // Remote wins, but preserve local base64Previews
        merged.push(hydrateTabGroup(remote as FirestoreTabGroup, local))
      } else {
        // Local wins
        merged.push(local)
      }
    }
  }

  // Sort by createdAt to maintain consistent order
  return merged.sort((a, b) => a.createdAt - b.createdAt)
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Check if tab groups have been migrated to Firestore
 */
export function hasTabGroupsMigrated(): boolean {
  return storage.getBoolean(MIGRATION_KEY) ?? false
}

/**
 * Mark tab groups as migrated to Firestore
 */
export function setTabGroupsMigrated(): void {
  storage.set(MIGRATION_KEY, true)
}

/**
 * Reset migration flag (for testing or after logout)
 */
export function resetTabGroupsMigration(): void {
  storage.remove(MIGRATION_KEY)
}

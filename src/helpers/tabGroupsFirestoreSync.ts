import { TabGroup, TabItem } from '~state/tabs'
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
 * TabGroup structure for Firestore (without base64Preview in tabs)
 */
export interface FirestoreTabGroup extends Omit<TabGroup, 'tabs'> {
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
 * Strip base64Preview from tabs for Firestore storage
 * base64Preview is large (50-200KB) and can be regenerated locally
 * Also removes all undefined values (Firestore doesn't support them)
 */
export function prepareTabGroupForSync(group: TabGroup): FirestoreTabGroup {
  const prepared = {
    ...group,
    updatedAt: Date.now(),
    tabs: group.tabs.map(tab => {
      const { base64Preview, ...tabWithoutPreview } = tab
      return tabWithoutPreview as FirestoreTabItem
    }),
  }

  return removeUndefined(prepared)
}

/**
 * Transform Firestore data back to local TabGroup format
 * Preserves local base64Preview if available
 */
export function hydrateTabGroup(
  firestoreGroup: FirestoreTabGroup,
  localGroup?: TabGroup
): TabGroup {
  return {
    ...firestoreGroup,
    tabs: firestoreGroup.tabs.map((firestoreTab, index) => {
      // Try to preserve local base64Preview
      const localTab = localGroup?.tabs.find(t => t.id === firestoreTab.id)
      return {
        ...firestoreTab,
        base64Preview: localTab?.base64Preview,
      } as TabItem
    }),
  }
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Sync a single tab group to Firestore
 */
export async function syncTabGroupToFirestore(userId: string, group: TabGroup): Promise<void> {
  const data = prepareTabGroupForSync(group)
  await writeToSubcollection(userId, 'tabGroups', group.id, data)
  console.log(`[TabGroupsSync] Synced group ${group.id} to Firestore`)
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

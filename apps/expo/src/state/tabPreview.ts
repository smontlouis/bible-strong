import type { TabBase, TabGroup } from './tabs'

/** Tabs saved before previews became files carried the JPEG inline, as base64. */
type LegacyTabPreview = { base64Preview?: unknown }

export type WithoutTabPreview<T> = T extends unknown ? Omit<T, 'previewUri'> : never

/**
 * A tab without its preview. The file belongs to this device, so the preview never
 * leaves it: not to Firestore, nor to a backup, an export or a Guest adoption.
 */
export const withoutTabPreview = <T extends TabBase>(tab: T): WithoutTabPreview<T> => {
  const {
    previewUri: _previewUri,
    base64Preview: _base64Preview,
    ...rest
  } = tab as T & LegacyTabPreview
  return rest as unknown as WithoutTabPreview<T>
}

/** Drops the inline preview of a tab saved by an earlier version. */
export const withoutLegacyTabPreview = <T extends TabBase>(tab: T): T => {
  if (!('base64Preview' in tab)) return tab
  const { base64Preview: _base64Preview, ...rest } = tab as T & LegacyTabPreview
  return rest as T
}

/**
 * On the web a preview is a data URI held for the session only: the browser has no file
 * to point to, and the image would fill the storage quota.
 */
export const isSessionTabPreview = (uri: string) => uri.startsWith('data:')

/** JSON replacer that keeps session previews out of the persisted tab groups. */
export const omitSessionTabPreview = (key: string, value: unknown) =>
  key === 'previewUri' && typeof value === 'string' && isSessionTabPreview(value)
    ? undefined
    : value

/**
 * The groups with the preview of one tab replaced. A preview is not a change of the tab:
 * the group keeps its `updatedAt`, so the sync sees nothing to send to Firestore. Returns
 * the same groups when the tab is absent or already shows this preview.
 */
export const withTabPreviewUri = (groups: TabGroup[], tabId: string, uri: string): TabGroup[] => {
  let changed = false
  const next = groups.map(group => {
    const index = group.tabs.findIndex(tab => tab.id === tabId)
    if (index === -1 || group.tabs[index]!.previewUri === uri) return group
    changed = true
    const tabs = group.tabs.slice()
    tabs[index] = { ...tabs[index]!, previewUri: uri }
    return { ...group, tabs }
  })
  return changed ? next : groups
}

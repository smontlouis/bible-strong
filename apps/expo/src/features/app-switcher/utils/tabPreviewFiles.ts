import * as FileSystem from 'expo-file-system/legacy'
import type { TabGroup } from '~state/tabs'

const DIRECTORY_NAME = 'tab-previews'

/** Where tab previews are kept on native. The web has no document directory. */
export const TAB_PREVIEWS_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${DIRECTORY_NAME}/`
  : null

// Captures written into the directory and not yet set on their tab: the sweep leaves them alone.
const pendingPreviews = new Set<string>()

/**
 * The file of a preview, without the version its address carries (`?v=`). A tab has one
 * file, named after it and overwritten by each capture; the version changes the address so
 * that `<Image>` does not keep showing the picture it cached.
 */
export const tabPreviewFilePath = (uri: string) => uri.split('?')[0]!

const tabPreviewFileOf = (directory: string, tabId: string) =>
  `${directory}${tabId.replace(/[^\w-]/g, '_')}.jpg`

let directoryReady: Promise<void> | undefined
const ensureDirectory = (directory: string) => {
  directoryReady ??= FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(
    error => {
      directoryReady = undefined
      throw error
    }
  )
  return directoryReady
}

// iOS returns the capture as a plain path, Android as a file:// URI.
const toFileUri = (uri: string) => (uri.startsWith('file://') ? uri : `file://${uri}`)

/**
 * Moves a capture out of the temporary directory onto the preview file of its tab, replacing
 * the previous picture, and returns the address to set on the tab: the file with the version
 * of this capture. Call `settleTabPreviewFile` once it is set on the tab.
 */
export const saveTabPreviewFile = async (tabId: string, capturedUri: string) => {
  const directory = TAB_PREVIEWS_DIRECTORY
  if (!directory) throw new Error('No document directory for tab previews')

  const from = toFileUri(capturedUri)
  const file = tabPreviewFileOf(directory, tabId)
  pendingPreviews.add(file)
  try {
    await ensureDirectory(directory)
    await FileSystem.deleteAsync(file, { idempotent: true })
    try {
      await FileSystem.moveAsync({ from, to: file })
    } catch {
      // Android cannot rename across volumes, and the capture may sit in the external cache.
      await FileSystem.copyAsync({ from, to: file })
      await FileSystem.deleteAsync(from, { idempotent: true }).catch(() => {})
    }
    return `${file}?v=${Date.now()}`
  } catch (error) {
    pendingPreviews.delete(file)
    await FileSystem.deleteAsync(from, { idempotent: true }).catch(() => {})
    throw error
  }
}

/** The capture is now on its tab, or was dropped: the sweep judges it like any other file. */
export const settleTabPreviewFile = (uri: string) => {
  pendingPreviews.delete(tabPreviewFilePath(uri))
}

export const isTabPreviewReferenced = (groups: TabGroup[], uri: string) => {
  const file = tabPreviewFilePath(uri)
  return groups.some(group =>
    group.tabs.some(tab => tab.previewUri && tabPreviewFilePath(tab.previewUri) === file)
  )
}

/** Deletes one preview file. Anything outside the directory (a web data URI) is ignored. */
export const deleteTabPreviewFile = async (uri: string) => {
  const file = tabPreviewFilePath(uri)
  if (!TAB_PREVIEWS_DIRECTORY || !file.startsWith(TAB_PREVIEWS_DIRECTORY)) return
  pendingPreviews.delete(file)
  await FileSystem.deleteAsync(file, { idempotent: true }).catch(error =>
    console.log('[TabPreviews] Could not delete', file, error)
  )
}

/**
 * Deletes every preview file that no tab refers to. Closing a tab or a group, a remote
 * deletion, a Guest adoption or a logout all end here, without each having to clean up.
 *
 * The groups are read after the directory is listed, so that a capture set on its tab in
 * the meantime is seen; one still on its way to its tab is pending.
 */
export const sweepTabPreviewFiles = async (getGroups: () => TabGroup[]) => {
  const directory = TAB_PREVIEWS_DIRECTORY
  if (!directory) return

  let names: string[]
  try {
    names = await FileSystem.readDirectoryAsync(directory)
  } catch {
    // No preview was saved yet.
    return
  }

  const referenced = new Set(
    getGroups().flatMap(group =>
      group.tabs.flatMap(tab => (tab.previewUri ? [tabPreviewFilePath(tab.previewUri)] : []))
    )
  )
  const orphans = names
    .map(name => `${directory}${name}`)
    .filter(uri => !referenced.has(uri) && !pendingPreviews.has(uri))

  await Promise.all(
    orphans.map(uri => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}))
  )
}

/**
 * iOS moves the app's container when the app is updated, and with it the absolute path of
 * every file. A preview saved before an update is still there, under the new directory.
 * Returns the groups with their previews pointing there, or undefined if none had moved.
 */
export const rebaseTabPreviewUris = (groups: TabGroup[]): TabGroup[] | undefined => {
  const directory = TAB_PREVIEWS_DIRECTORY
  if (!directory) return undefined

  const segment = `/${DIRECTORY_NAME}/`
  let changed = false
  const rebased = groups.map(group => {
    let groupChanged = false
    const tabs = group.tabs.map(tab => {
      const uri = tab.previewUri
      if (!uri || uri.startsWith(directory)) return tab
      const index = uri.lastIndexOf(segment)
      if (index === -1) return tab
      groupChanged = true
      return { ...tab, previewUri: `${directory}${uri.slice(index + segment.length)}` }
    })
    if (!groupChanged) return group
    changed = true
    return { ...group, tabs }
  })

  return changed ? rebased : undefined
}

import { useStore } from 'jotai/react'
import { useEffect } from 'react'
import { tabGroupsAtom } from '~state/tabs'
import {
  TAB_PREVIEWS_DIRECTORY,
  rebaseTabPreviewUris,
  sweepTabPreviewFiles,
} from './tabPreviewFiles'

/** Lets a burst of changes (closing several tabs, a remote sync) settle before sweeping. */
export const TAB_PREVIEW_SWEEP_DELAY = 2000

/**
 * Keeps the previews directory to the files that tabs still show: once after launch, then
 * once each run of tab group changes has settled. Nothing else deletes the preview of a
 * closed tab.
 */
export const useTabPreviewFilesSweep = () => {
  const store = useStore()

  useEffect(() => {
    // The web keeps its previews in memory only.
    if (!TAB_PREVIEWS_DIRECTORY) return

    // The groups are already read from storage. Previews saved before an iOS update are found
    // again under the new container before anything is swept.
    const rebased = rebaseTabPreviewUris(store.get(tabGroupsAtom))
    if (rebased) store.set(tabGroupsAtom, rebased)

    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleSweep = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        sweepTabPreviewFiles(() => store.get(tabGroupsAtom))
      }, TAB_PREVIEW_SWEEP_DELAY)
    }

    scheduleSweep()
    const unsubscribe = store.sub(tabGroupsAtom, scheduleSweep)
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [store])
}

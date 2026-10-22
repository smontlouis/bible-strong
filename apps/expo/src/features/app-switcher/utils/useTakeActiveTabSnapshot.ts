import { PixelRatio, Platform, type View } from 'react-native'
import { runAfterInteractions } from '~helpers/runAfterInteractions'
import { useSetAtom, useStore } from 'jotai/react'
import { captureRef } from 'react-native-view-shot'
import useDynamicRefs from '~helpers/useDynamicRefs'
import { setTabPreviewAtom, tabGroupsAtom, tabsAtom } from '../../../state/tabs'
import {
  deleteTabPreviewFile,
  isTabPreviewReferenced,
  saveTabPreviewFile,
  settleTabPreviewFile,
  tabPreviewFilePath,
} from './tabPreviewFiles'

/**
 * Previews are faded thumbnails and placeholders: half the pixels of the screen are plenty.
 * iOS sizes a capture in points and renders it at the screen scale; Android and the web size
 * it in pixels.
 */
const measurePreviewSize = (view: View) =>
  new Promise<{ width: number; height: number } | undefined>(resolve => {
    // A view that no longer answers is captured at its full size rather than waited for.
    const timeout = setTimeout(() => resolve(undefined), 250)
    try {
      view.measure((_x, _y, width, height) => {
        clearTimeout(timeout)
        if (!width || !height) return resolve(undefined)
        const scale = Platform.OS === 'ios' ? 0.5 : PixelRatio.get() / 2
        resolve({ width: Math.round(width * scale), height: Math.round(height * scale) })
      })
    } catch {
      clearTimeout(timeout)
      resolve(undefined)
    }
  })

const useTakeActiveTabSnapshot = () => {
  const store = useStore()
  const setTabPreview = useSetAtom(setTabPreviewAtom)
  const [getRef] = useDynamicRefs<View>()

  const captureSnapshot = async (activeTabIndex: number, activeAtomId: string) => {
    if (typeof activeTabIndex === 'undefined') {
      console.log('[useTakeActiveTabSnapshot] No active tab')
      return
    }

    if (!activeAtomId) {
      console.log('[useTakeActiveTabSnapshot] No active tab id')
      return
    }

    const cachedTabScreen = getRef(activeAtomId)

    if (!cachedTabScreen) {
      console.log('[useTakeActiveTabSnapshot] No active tab')
      return
    }

    // The web keeps a data URI for the session; native writes a file kept across launches.
    const isWeb = Platform.OS === 'web'
    const size = await measurePreviewSize(cachedTabScreen)
    const uri = await captureRef(cachedTabScreen, {
      result: isWeb ? 'data-uri' : 'tmpfile',
      format: 'jpg',
      quality: 0.8,
      ...size,
    })
      .then(captured => (isWeb ? captured : saveTabPreviewFile(activeAtomId, captured)))
      .catch(error => console.error('Oops, snapshot failed', error))

    if (!uri) {
      return
    }

    const tab = store.get(tabsAtom)[activeTabIndex]
    if (!tab) {
      settleTabPreviewFile(uri)
      deleteTabPreviewFile(uri)
      return
    }

    const previousUri = tab.previewUri
    // A new picture of the tab is not a change to sync: the group keeps its date.
    setTabPreview({ tabId: tab.id, uri })
    settleTabPreviewFile(uri)

    // The capture overwrote the file of this tab. A tab opened as a copy of another may still
    // point to that other tab's file: it goes once no tab shows it any more.
    if (
      previousUri &&
      tabPreviewFilePath(previousUri) !== tabPreviewFilePath(uri) &&
      !isTabPreviewReferenced(store.get(tabGroupsAtom), previousUri)
    ) {
      deleteTabPreviewFile(previousUri)
    }
  }

  /**
   * Deferred variant: captures snapshot after all interactions settle.
   * Use this when called from Reanimated animation callbacks (via runOnJS)
   * to avoid competing with post-animation settling.
   */
  const captureDeferredSnapshot = (activeTabIndex: number, activeAtomId: string) => {
    runAfterInteractions(() => {
      captureSnapshot(activeTabIndex, activeAtomId)
    })
  }

  return { captureSnapshot, captureDeferredSnapshot }
}

export default useTakeActiveTabSnapshot

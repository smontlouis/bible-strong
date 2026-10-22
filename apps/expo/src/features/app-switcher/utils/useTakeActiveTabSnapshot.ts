import { PixelRatio, Platform, type View } from 'react-native'
import { runAfterInteractions } from '~helpers/runAfterInteractions'
import produceDraft from 'immer'
import { useSetAtom, useStore } from 'jotai/react'
import { captureRef } from 'react-native-view-shot'
import useDynamicRefs from '~helpers/useDynamicRefs'
import { tabGroupsAtom, tabsAtom } from '../../../state/tabs'
import {
  deleteTabPreviewFile,
  isTabPreviewReferenced,
  saveTabPreviewFile,
  settleTabPreviewFile,
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
  const setTabs = useSetAtom(tabsAtom)
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
    setTabs(
      produceDraft(draft => {
        if (draft[activeTabIndex]) {
          draft[activeTabIndex].previewUri = uri
        }
      })
    )
    settleTabPreviewFile(uri)

    // The replaced picture goes at once, unless another tab still shows the same file.
    if (
      previousUri &&
      previousUri !== uri &&
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

import { InteractionManager } from 'react-native'
import produce from 'immer'
import { useSetAtom } from 'jotai/react'
import { captureRef } from 'react-native-view-shot'
import useDynamicRefs from '~helpers/useDynamicRefs'
import { tabsAtom } from '../../../state/tabs'

const useTakeActiveTabSnapshot = () => {
  const setTabs = useSetAtom(tabsAtom)
  const [getRef] = useDynamicRefs()

  const captureSnapshot = async (activeTabIndex: number, activeAtomId: string) => {
    if (typeof activeTabIndex === 'undefined') {
      console.log('[useTakeActiveTabSnapshot] No active tab')
      return
    }

    if (!activeAtomId) {
      console.log('[useTakeActiveTabSnapshot] No active tab id')
      return
    }

    const cachedTabScreenRef = getRef(activeAtomId)

    if (!cachedTabScreenRef) {
      console.log('[useTakeActiveTabSnapshot] No active tab')
      return
    }

    const data = await captureRef(cachedTabScreenRef, {
      result: 'base64',
      format: 'jpg',
      quality: 0.8,
    }).catch(error => console.error('Oops, snapshot failed', error))

    // @ts-ignore
    const resolution = /^(\d+):(\d+)\|/g.exec(data)
    // @ts-ignore
    const base64 = data.substr((resolution || [''])[0].length || 0)

    setTabs(
      produce(draft => {
        if (draft[activeTabIndex]) {
          draft[activeTabIndex].base64Preview = base64
        }
      })
    )
  }

  /**
   * Deferred variant: captures snapshot after all interactions settle.
   * Use this when called from Reanimated animation callbacks (via runOnJS)
   * to avoid competing with post-animation settling.
   */
  const captureDeferredSnapshot = (activeTabIndex: number, activeAtomId: string) => {
    InteractionManager.runAfterInteractions(() => {
      captureSnapshot(activeTabIndex, activeAtomId)
    })
  }

  return { captureSnapshot, captureDeferredSnapshot }
}

export default useTakeActiveTabSnapshot

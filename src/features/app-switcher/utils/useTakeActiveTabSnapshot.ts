import produce from 'immer'
import { useSetAtom } from 'jotai/react'
import { captureRef } from 'react-native-view-shot'
import useDynamicRefs from '~helpers/useDynamicRefs'
import { tabsAtom } from '../../../state/tabs'

const useTakeActiveTabSnapshot = () => {
  const setTabs = useSetAtom(tabsAtom)
  const [getRef] = useDynamicRefs()

  return async (activeTabIndex: number, activeAtomId: string) => {
    try {
      if (typeof activeTabIndex === 'undefined') {
        throw new Error('No active tab')
      }

      const cachedTabScreenRef = getRef(activeAtomId)

      if (!cachedTabScreenRef) {
        throw new Error('No active tab')
      }

      const data = await captureRef(cachedTabScreenRef, {
        result: 'base64',
        format: 'png',
      }).catch(error => console.error('Oops, snapshot failed', error))

      const resolution = /^(\d+):(\d+)\|/g.exec(data)
      const base64 = data.substr((resolution || [''])[0].length || 0)

      setTabs(
        produce(draft => {
          draft[activeTabIndex].base64Preview = base64
        })
      )
    } catch {
      console.log('Error taking snapshot')
    }
  }
}

export default useTakeActiveTabSnapshot

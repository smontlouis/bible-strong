import produce from 'immer'
import { useSetAtom } from 'jotai'
import { captureRef } from 'react-native-view-shot'
import { tabsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

const useTakeActiveTabSnapshot = () => {
  const { activeTabScreen } = useAppSwitcherContext()
  const setTabsAtom = useSetAtom(tabsAtom)

  return async (activeTabIndex?: number) => {
    if (!activeTabScreen.ref || typeof activeTabIndex === 'undefined') {
      throw new Error('No active tab')
    }

    const data = await captureRef(activeTabScreen.ref, {
      result: 'base64',
      format: 'png',
    })
    const resolution = /^(\d+):(\d+)\|/g.exec(data)
    const base64 = data.substr((resolution || [''])[0].length || 0)

    setTabsAtom(
      produce(draft => {
        draft[activeTabIndex].base64Preview = base64
      })
    )
  }
}

export default useTakeActiveTabSnapshot

import produce from 'immer'
import { useAtomValue, useSetAtom } from 'jotai'
import { captureRef } from 'react-native-view-shot'
import { cachedTabIdsAtom, tabsAtom, tabsAtomsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

const useTakeActiveTabSnapshot = () => {
  const tabsAtoms = useAtomValue(tabsAtomsAtom)
  const setTabs = useSetAtom(tabsAtom)
  const cachedTabIds = useAtomValue(cachedTabIdsAtom)
  const { cachedTabScreens } = useAppSwitcherContext()

  return async (activeTabIndex?: number) => {
    if (typeof activeTabIndex === 'undefined') {
      throw new Error('No active tab')
    }

    const atomId = tabsAtoms[activeTabIndex].toString()
    const cachedTabScreenRef = cachedTabScreens.refs[atomId]

    if (!cachedTabScreenRef) {
      throw new Error('No active tab')
    }

    const data = await captureRef(cachedTabScreenRef, {
      result: 'base64',
      format: 'png',
    })
    const resolution = /^(\d+):(\d+)\|/g.exec(data)
    const base64 = data.substr((resolution || [''])[0].length || 0)

    setTabs(
      produce(draft => {
        draft[activeTabIndex].base64Preview = base64
      })
    )
  }
}

export default useTakeActiveTabSnapshot

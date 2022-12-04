import { useAtom, useSetAtom } from 'jotai'
import { activeTabIndexAtom, tabsAtom } from '../../../state/tabs'

const useBibleButtonPress = () => {
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const [tabs] = useAtom(tabsAtom)

  const onPress = () => {
    setActiveTabIndex(tabs.findIndex(tab => tab.id === 'bible'))
  }

  return {
    onPress,
  }
}

export default useBibleButtonPress

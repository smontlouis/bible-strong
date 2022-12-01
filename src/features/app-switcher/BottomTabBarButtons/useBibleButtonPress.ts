import { useAtom } from 'jotai'
import { activeTabIndexAtom, tabsAtom } from '../../../state/tabs'

const useBibleButtonPress = () => {
  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)
  const [tabs] = useAtom(tabsAtom)

  const onPress = () => {
    setActiveTabIndex(tabs.findIndex(tab => tab.id === 'bible'))
  }

  return {
    isActive: activeTabIndex === tabs.findIndex(tab => tab.id === 'bible'),
    onPress,
  }
}

export default useBibleButtonPress

import { useAtom } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useEffect } from 'react'
import { ViewStyle } from 'react-native'
import { appSwitcherModeAtom, tabsCountAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useMeasureTabPreview from '../utils/useMesureTabPreview'
import useScrollToTab from '../utils/useScrollToTab'
import { useTabAnimations } from '../utils/useTabAnimations'

const useBottomTabBar = () => {
  const [appSwitcherMode, setAppSwitcherMode] = useAtom(appSwitcherModeAtom)

  const { expandTab } = useTabAnimations()
  const { activeTabPreview } = useAppSwitcherContext()
  const { measureTabPreview, isTabVisible } = useMeasureTabPreview()
  const scrollToTab = useScrollToTab()

  const onPress = async () => {
    const index = activeTabPreview.index.get()

    // Scroller seulement si le tab n'est pas visible dans le viewport
    if (!isTabVisible(index)) {
      await scrollToTab(index)
    }

    const { pageX, pageY } = await measureTabPreview(index)
    expandTab({
      index,
      left: pageX,
      top: pageY,
    })
  }

  useEffect(() => {
    const tabsCount = getDefaultStore().get(tabsCountAtom)
    if (tabsCount === 0) {
      setAppSwitcherMode('list')
    }
  }, [])

  const isViewMode = appSwitcherMode === 'view'

  const viewStyles: ViewStyle & Record<string, unknown> = {
    transform: [{ translateY: isViewMode ? 0 : -30 }],
    opacity: isViewMode ? 1 : 0,
    transitionProperty: ['transform', 'opacity'],
    transitionDuration: 300,
    pointerEvents: isViewMode ? ('auto' as const) : ('none' as const),
  }

  const listStyles: ViewStyle & Record<string, unknown> = {
    transform: [{ translateY: isViewMode ? 30 : 0 }],
    opacity: isViewMode ? 0 : 1,
    transitionProperty: ['transform', 'opacity'],
    transitionDuration: 300,
    pointerEvents: isViewMode ? ('none' as const) : ('auto' as const),
  }

  return {
    onPress,
    listStyles,
    viewStyles,
  }
}

export default useBottomTabBar

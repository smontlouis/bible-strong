import { useAtom } from 'jotai'
import { useEffect } from 'react'
import {
  withTiming,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withDelay,
} from 'react-native-reanimated'
import {
  activeTabIndexAtom,
  tabActiveTabSnapshotAtom,
  activeTabPropertiesAtom,
  tabsAtom,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from '../TabScreen/TabScreen'

const useTabButtonPress = () => {
  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)
  const { isBottomTabBarVisible } = useAppSwitcherContext()
  const [tabs] = useAtom(tabsAtom)
  const [, tabActiveTabSnapshot] = useAtom(tabActiveTabSnapshotAtom)
  const [activeTabProperties, setActiveTabProperties] = useAtom(
    activeTabPropertiesAtom
  )
  const { animationProgress } = activeTabProperties || {}
  const tabsLength = tabs.length
  const scale = useSharedValue(1)

  const onClose = () => {
    setActiveTabIndex(undefined)
    setActiveTabProperties(undefined)
  }

  const onPress = async () => {
    if (animationProgress?.value) {
      await tabActiveTabSnapshot(activeTabIndex)
      isBottomTabBarVisible.value = withTiming(0)
      animationProgress.value = withTiming(0, tabTimingConfig, () => {
        runOnJS(onClose)()
      })
    }
  }

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: scale.value,
      },
    ],
  }))

  useEffect(() => {
    scale.value = withDelay(
      300,
      withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      )
    )
  }, [tabsLength, scale])

  return { onPress, tabsLength, iconStyle }
}

export default useTabButtonPress

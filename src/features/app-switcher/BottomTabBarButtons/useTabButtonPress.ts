import { useAtom } from 'jotai'
import { useEffect } from 'react'
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import {
  activeTabIndexAtom,
  tabActiveTabSnapshotAtom,
  tabsAtom,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from '../utils/constants'

const useTabButtonPress = () => {
  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)

  const { activeTabPreview, activeTabScreen } = useAppSwitcherContext()

  const [tabs] = useAtom(tabsAtom)
  const [, tabActiveTabSnapshot] = useAtom(tabActiveTabSnapshotAtom)
  const tabsLength = tabs.length
  const scale = useSharedValue(1)

  const onPress = async () => {
    await tabActiveTabSnapshot(activeTabIndex)
    activeTabScreen.opacity.value = withTiming(0)
    activeTabPreview.animationProgress.value = withTiming(
      0,
      tabTimingConfig,
      () => {
        activeTabPreview.zIndex.value = 2
      }
    )
    runOnJS(setActiveTabIndex)(undefined)
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

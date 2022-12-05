import { useAtom, useAtomValue } from 'jotai'
import { useEffect } from 'react'
import {
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
} from '../../../../state/tabs'
import { useTabAnimations } from '../../utils/worklets'

const useTabButtonPress = () => {
  const activeTabIndex = useAtomValue(activeTabIndexAtom)

  const { minimizeTab } = useTabAnimations()

  const [tabs] = useAtom(tabsAtom)
  const [, tabActiveTabSnapshot] = useAtom(tabActiveTabSnapshotAtom)
  const tabsLength = tabs.length
  const scale = useSharedValue(1)

  const onPress = async () => {
    await tabActiveTabSnapshot(activeTabIndex)
    minimizeTab()
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

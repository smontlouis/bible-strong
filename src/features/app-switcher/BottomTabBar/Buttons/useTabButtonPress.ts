import { useAtomValue } from 'jotai'
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import useTakeActiveTabSnapshot from '~features/app-switcher/utils/useTakeActiveTabSnapshot'
import useDidUpdate from '~helpers/useDidUpdate'
import {
  activeTabIndexAtom,
  tabsAtom,
  tabsCountAtom,
} from '../../../../state/tabs'
import { useTabAnimations } from '../../utils/useTabAnimations'

const useTabButtonPress = () => {
  const activeTabIndex = useAtomValue(activeTabIndexAtom)
  const tabs = useAtomValue(tabsAtom)
  const tabsCount = useAtomValue(tabsCountAtom)
  const takeActiveTabSnapshot = useTakeActiveTabSnapshot()

  const { minimizeTab } = useTabAnimations()

  const scale = useSharedValue(1)

  const onPress = async () => {
    if (!tabs[activeTabIndex].base64Preview) {
      await takeActiveTabSnapshot(activeTabIndex)
    }
    minimizeTab()
  }

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: scale.value,
      },
    ],
  }))

  useDidUpdate(() => {
    scale.value = withDelay(
      300,
      withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      )
    )
  }, [tabsCount, scale])

  return { onPress, tabsCount, iconStyle }
}

export default useTabButtonPress

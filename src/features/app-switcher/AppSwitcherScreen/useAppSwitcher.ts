import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

const useAppSwitcher = () => {
  const { scrollView } = useAppSwitcherContext()

  const PADDING_HORIZONTAL = 20

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollView.y.value = event.contentOffset.y
    },
  })

  const scrollViewBoxStyle = useAnimatedStyle(() => {
    return { paddingBottom: scrollView.padding.value }
  })

  return {
    scrollHandler,
    PADDING_HORIZONTAL,
    scrollViewBoxStyle,
  }
}

export default useAppSwitcher

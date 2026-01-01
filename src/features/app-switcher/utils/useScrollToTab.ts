import { useAppSwitcherContext } from '../AppSwitcherProvider'

interface ScrollOptions {
  animated?: boolean // défaut: false (comportement actuel)
}

/**
 * Hook that provides a function to scroll the FlashList to show a specific tab.
 */
const useScrollToTab = () => {
  const { flashListRefs } = useAppSwitcherContext()

  const scrollToTab = async (index: number, options: ScrollOptions = {}) => {
    const { animated = false } = options

    const flashListRef = flashListRefs.getActiveRef()
    await flashListRef.current?.scrollToIndex({ index, animated, viewOffset: -200 })
  }

  return scrollToTab
}

export default useScrollToTab

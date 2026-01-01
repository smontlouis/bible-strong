import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useScrollToTab from './useScrollToTab'

/**
 * Hook that scrolls to the active tab index.
 * Automatically gets the current active index from activeTabPreview.
 */
const useScrollToActiveTab = () => {
  const { activeTabPreview } = useAppSwitcherContext()
  const scrollToTab = useScrollToTab()

  const scrollToActiveTab = async () => {
    const index = activeTabPreview.index.get()
    await scrollToTab(index)
  }

  return scrollToActiveTab
}

export default useScrollToActiveTab

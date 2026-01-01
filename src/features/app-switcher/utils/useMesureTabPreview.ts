import { useAppSwitcherContext } from '../AppSwitcherProvider'

const useMeasureTabPreview = () => {
  const { tabPreviews } = useAppSwitcherContext()

  // Vérifie si un tab est visible dans le viewport (via onViewableItemsChanged)
  const isTabVisible = (index: number): boolean => {
    return tabPreviews.visibleIndices.current.has(index)
  }

  const measureTabPreview = async (
    index: number
  ): Promise<{
    x: number
    y: number
    width: number
    height: number
    pageX: number
    pageY: number
  }> =>
    new Promise(resolve => {
      tabPreviews.refs.current[index].current?.measure((x, y, width, height, pageX, pageY) =>
        resolve({ x, y, width, height, pageX, pageY })
      )
    })

  return { measureTabPreview, isTabVisible }
}

export default useMeasureTabPreview

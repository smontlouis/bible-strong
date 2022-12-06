import { useAppSwitcherContext } from '../AppSwitcherProvider'

const useMeasureTabPreview = () => {
  const { tabPreviews } = useAppSwitcherContext()

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
      tabPreviews.refs[
        index
      ].current?.measure((x, y, width, height, pageX, pageY) =>
        resolve({ x, y, width, height, pageX, pageY })
      )
    })

  return measureTabPreview
}

export default useMeasureTabPreview

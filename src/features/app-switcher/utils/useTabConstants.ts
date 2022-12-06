import { useWindowDimensions } from 'react-native'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'

const useTabConstants = () => {
  const { height: HEIGHT, width: WIDTH } = useWindowDimensions()

  const TABS_PER_ROW = 2
  const SCREEN_MARGIN = 20
  const GAP = 20
  const TEXTBOX_HEIGHT = 20
  const HEIGHT_REDUCER_COEFFICIENT = 0.62
  const TAB_PREVIEW_WIDTH =
    (WIDTH - SCREEN_MARGIN * 2 - (TABS_PER_ROW - 1) * GAP) / TABS_PER_ROW
  const TAB_PREVIEW_HEIGHT =
    ((TAB_PREVIEW_WIDTH * HEIGHT) / WIDTH) * HEIGHT_REDUCER_COEFFICIENT
  const TAB_BORDER_RADIUS = (TAB_PREVIEW_WIDTH * 40) / WIDTH
  const STATUS_BAR_HEIGHT = getStatusBarHeight()

  return {
    TABS_PER_ROW,
    SCREEN_MARGIN,
    GAP,
    TAB_PREVIEW_WIDTH,
    TAB_PREVIEW_HEIGHT,
    TAB_BORDER_RADIUS,
    WIDTH,
    HEIGHT,
    TEXTBOX_HEIGHT,
    STATUS_BAR_HEIGHT,
  }
}

export default useTabConstants

import { initialWindowMetrics } from 'react-native-safe-area-context'

export const BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0
export const MODAL_FOOTER_HEIGHT = 54
export const MODAL_FOOTER_HEIGHT_BOTTOM_INSET = MODAL_FOOTER_HEIGHT + BOTTOM_INSET

import { Platform } from 'react-native'
import { initialWindowMetrics } from 'react-native-safe-area-context'

export const BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0
export const MODAL_FOOTER_HEIGHT = 54
export const MODAL_FOOTER_HEIGHT_BOTTOM_INSET = MODAL_FOOTER_HEIGHT + BOTTOM_INSET

// Color management constants
export const MAX_CUSTOM_COLORS = 20
export const COLOR_CIRCLE_MIN_WIDTH = 40
export { DEFAULT_COLOR_KEYS, type DefaultColorKey } from '~themes/themePalette'

export const IS_FORM_SHEET = Platform.OS === 'ios'

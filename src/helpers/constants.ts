import { initialWindowMetrics } from 'react-native-safe-area-context'

export const BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0
export const MODAL_FOOTER_HEIGHT = 54
export const MODAL_FOOTER_HEIGHT_BOTTOM_INSET = MODAL_FOOTER_HEIGHT + BOTTOM_INSET

// Color management constants
export const MAX_CUSTOM_COLORS = 5
export const COLOR_CIRCLE_MIN_WIDTH = 40
export const DEFAULT_COLOR_KEYS = ['color1', 'color2', 'color3', 'color4', 'color5'] as const
export type DefaultColorKey = (typeof DEFAULT_COLOR_KEYS)[number]

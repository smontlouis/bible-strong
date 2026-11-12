import type { WidePage } from './widePage'

export {
  WIDE_PAGE_HEADER_HEIGHT,
  WIDE_PAGE_MAX_WIDTH,
  WIDE_PAGE_MIN_WIDTH,
  type WidePage,
} from './widePage'

/**
 * Whether a page may set two columns (design-system README, « The app »). The native apps keep
 * their single column: only a large Web window, measured by `useWidePage.web.ts`, has the room
 * and the `position: sticky` that keeps a column in place.
 */
export const useWidePage = (_minWidth?: number): WidePage => ({ wide: false, height: 0 })

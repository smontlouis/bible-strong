// ============================================================================
// ANNOTATION MODE EXPORTS
// ============================================================================

// Re-export types used by BibleDOMComponent
export type AnnotationType = 'background' | 'underline' | 'circle'

// Hooks
export { useAnnotationHighlights } from './useAnnotationHighlights'
export { useTouchSelection } from './useTouchSelection'
export { useAnnotationEvents } from './useAnnotationEvents'
export { useAnnotationModeController } from './useAnnotationModeController'

// Selection components
export { SelectionHandles } from './SelectionHandles'
export type { SelectionHandlesProps } from './SelectionHandles'

// Highlight components
export {
  HighlightLayer,
  HighlightRectDiv,
  SelectionHandle,
  getAnimationDelay,
} from './HighlightComponents'
export type { HighlightRect } from './HighlightComponents'

// Selection utilities
export type { SelectionRange, WordPosition } from './selectionUtils'
export { normalizeRange, getVersesBetween, buildRangesFromSelection } from './selectionUtils'

// DOM utilities
export { getCaretInfoFromPoint, findVerseContainer } from './domUtils'

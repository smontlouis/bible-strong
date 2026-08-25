import type { VersionCode } from '~state/tabs'

export type AnnotationType = 'background' | 'underline' | 'circle'

export interface WordPosition {
  verseKey: string
  wordIndex: number
}

export interface SelectionRange {
  start: WordPosition
  end: WordPosition
}

export interface AnnotationApplyTrigger {
  count: number
  color: string
  type: AnnotationType
}

export interface AnnotationSessionState {
  enabled: boolean
  version?: VersionCode
  hasSelection: boolean
  selection: SelectionRange | null
  clearSelectionTrigger: number
  applyAnnotationTrigger: AnnotationApplyTrigger
  eraseSelectionTrigger: number
  selectedAnnotationId: string | null
  clearAnnotationSelectionTrigger: number
}

export const INITIAL_ANNOTATION_SESSION_STATE: AnnotationSessionState = {
  enabled: false,
  hasSelection: false,
  selection: null,
  clearSelectionTrigger: 0,
  applyAnnotationTrigger: { count: 0, color: '', type: 'background' },
  eraseSelectionTrigger: 0,
  selectedAnnotationId: null,
  clearAnnotationSelectionTrigger: 0,
}

export const enterAnnotationSession = (version: VersionCode): AnnotationSessionState => ({
  ...INITIAL_ANNOTATION_SESSION_STATE,
  enabled: true,
  version,
})

export const exitAnnotationSession = (): AnnotationSessionState => INITIAL_ANNOTATION_SESSION_STATE

export const updateAnnotationSelection = (
  state: AnnotationSessionState,
  hasSelection: boolean,
  selection: SelectionRange | null
): AnnotationSessionState => {
  const isValid = hasSelection && selection?.start && selection?.end

  return {
    ...state,
    hasSelection: !!isValid,
    selection: isValid ? selection : null,
  }
}

export const requestApplyAnnotation = (
  state: AnnotationSessionState,
  color: string,
  type: AnnotationType
): AnnotationSessionState => {
  if (!state.hasSelection) return state

  return {
    ...state,
    applyAnnotationTrigger: {
      count: state.applyAnnotationTrigger.count + 1,
      color,
      type,
    },
  }
}

export const requestClearAnnotationSelectionRange = (
  state: AnnotationSessionState
): AnnotationSessionState => ({
  ...state,
  hasSelection: false,
  selection: null,
  clearSelectionTrigger: state.clearSelectionTrigger + 1,
})

export const requestEraseAnnotationSelection = (
  state: AnnotationSessionState
): AnnotationSessionState => {
  if (!state.hasSelection) return state

  return {
    ...state,
    eraseSelectionTrigger: state.eraseSelectionTrigger + 1,
  }
}

export const markAnnotationCreated = (
  state: AnnotationSessionState,
  annotationId: string
): AnnotationSessionState => ({
  ...state,
  hasSelection: false,
  selection: null,
  selectedAnnotationId: annotationId,
})

export const markAnnotationSelectionErased = (
  state: AnnotationSessionState
): AnnotationSessionState => ({
  ...state,
  hasSelection: false,
  selection: null,
})

export const selectAnnotation = (
  state: AnnotationSessionState,
  annotationId: string | null
): AnnotationSessionState => ({
  ...state,
  selectedAnnotationId: annotationId,
  hasSelection: false,
  selection: null,
})

export const clearSelectedAnnotation = (state: AnnotationSessionState): AnnotationSessionState => ({
  ...state,
  selectedAnnotationId: null,
  clearAnnotationSelectionTrigger: state.clearAnnotationSelectionTrigger + 1,
})

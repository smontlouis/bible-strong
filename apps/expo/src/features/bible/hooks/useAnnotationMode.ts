import { useState, useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai/react'
import { atom, getDefaultStore, type PrimitiveAtom } from 'jotai/vanilla'
import { useDispatch, useSelector } from 'react-redux'

import { useFeatureOnboarding, ONBOARDING_IDS } from '~features/feature-onboarding'
import {
  removeWordAnnotationAction,
  changeWordAnnotationColorAction,
  changeWordAnnotationTypeAction,
} from '~redux/modules/user/wordAnnotations'
import { VersionCode } from '~state/tabs'
import { RootState } from '~redux/modules/reducer'
import { getWordAnnotationText } from '~redux/modules/user/wordAnnotationRanges'
import {
  INITIAL_ANNOTATION_SESSION_STATE,
  clearSelectedAnnotation,
  enterAnnotationSession,
  exitAnnotationSession,
  requestApplyAnnotation,
  requestClearAnnotationSelectionRange,
  requestEraseAnnotationSelection,
  selectAnnotation,
  type AnnotationSessionState,
  type AnnotationType,
  type SelectionRange,
} from './annotationSession'

export type { AnnotationType, SelectionRange, WordPosition } from './annotationSession'

export interface SelectedAnnotation {
  id: string
  verseKey: string
  text: string
  color: string
  type: AnnotationType
  noteId?: string
  tags?: { [id: string]: { id: string; name: string } }
  /** The words it marks, verse by verse. */
  ranges: { verseKey: string; startWordIndex: number; endWordIndex: number }[]
}

export interface AnnotationModeState {
  enabled: boolean
  version?: VersionCode
  /** The verse touched to enter the mode, where the desktop menu opens. */
  entryVerseKey?: string
  hasSelection: boolean
  selection: SelectionRange | null
  clearSelectionTrigger: number
  applyAnnotationTrigger: {
    count: number
    color: string
    type: AnnotationType
  }
  eraseSelectionTrigger: number
  selectedAnnotation: SelectedAnnotation | null
  clearAnnotationSelectionTrigger: number
}

export interface WebViewRef {
  injectJavaScript: (script: string) => void
}

export interface UseAnnotationModeReturn extends AnnotationModeState {
  /**
   * The session itself, in the Jotai store: Reader intents write it (ADR-0098), the methods below
   * serve the controls of the application.
   */
  session: PrimitiveAtom<AnnotationSessionState>
  enterMode: (version: VersionCode) => void
  exitMode: () => void
  setWebViewRef: (ref: WebViewRef | null) => void
  applyAnnotation: (color: string, type: AnnotationType) => void
  clearSelection: () => void
  eraseSelection: () => void
  handleAnnotationSelected: (annotationId: string | null) => void
  changeAnnotationColor: (color: string) => void
  changeAnnotationType: (type: AnnotationType) => void
  deleteSelectedAnnotation: () => void
  clearAnnotationSelection: () => void
}

const store = getDefaultStore()

export function useAnnotationMode(): UseAnnotationModeReturn {
  const [session] = useState(() => atom(INITIAL_ANNOTATION_SESSION_STATE))
  const state = useAtomValue(session, { store })
  const setState = (
    next: AnnotationSessionState | ((prev: AnnotationSessionState) => AnnotationSessionState)
  ) => store.set(session, next)
  const reduxDispatch = useDispatch()
  const webViewRef = useRef<WebViewRef | null>(null)
  const featureOnboarding = useFeatureOnboarding()

  // Each entry into the mode, however it came, may show the mode's onboarding.
  const { enabled } = state
  useEffect(() => {
    if (enabled) featureOnboarding.triggerIfNeeded(ONBOARDING_IDS.ANNOTATION_MODE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Only subscribe to the specific selected annotation, not the entire map
  const selectedAnnotationId = state.selectedAnnotationId
  const selectedAnnotationFromRedux = useSelector((state: RootState) => {
    if (!selectedAnnotationId) return null
    return (state.user.bible.wordAnnotations ?? {})[selectedAnnotationId] ?? null
  })

  // Derive selectedAnnotation from the targeted Redux subscription
  const selectedAnnotation: SelectedAnnotation | null = (() => {
    if (!selectedAnnotationId || !selectedAnnotationFromRedux) return null

    const firstRange = selectedAnnotationFromRedux.ranges[0]
    if (!firstRange) return null

    return {
      id: selectedAnnotationId,
      verseKey: firstRange.verseKey,
      text: getWordAnnotationText(selectedAnnotationFromRedux),
      color: selectedAnnotationFromRedux.color,
      type: selectedAnnotationFromRedux.type,
      noteId: selectedAnnotationFromRedux.noteId,
      tags: selectedAnnotationFromRedux.tags,
      ranges: selectedAnnotationFromRedux.ranges,
    }
  })()

  const setWebViewRef = (ref: WebViewRef | null) => {
    webViewRef.current = ref
  }

  const enterMode = (version: VersionCode) => {
    setState(enterAnnotationSession(version))
  }

  const exitMode = () => {
    setState(exitAnnotationSession())
  }

  const applyAnnotation = (color: string, type: AnnotationType) => {
    setState(prev => requestApplyAnnotation(prev, color, type))
  }

  const clearSelection = () => {
    setState(requestClearAnnotationSelectionRange)
  }

  const eraseSelection = () => {
    setState(requestEraseAnnotationSelection)
  }

  const handleAnnotationSelected = (annotationId: string | null) => {
    setState(prev => selectAnnotation(prev, annotationId))
  }

  const changeAnnotationColor = (color: string) => {
    if (!state.selectedAnnotationId) return
    reduxDispatch(changeWordAnnotationColorAction(state.selectedAnnotationId, color))
  }

  const changeAnnotationType = (type: AnnotationType) => {
    if (!state.selectedAnnotationId) return
    reduxDispatch(changeWordAnnotationTypeAction(state.selectedAnnotationId, type))
  }

  const deleteSelectedAnnotation = () => {
    if (!state.selectedAnnotationId) return
    reduxDispatch(removeWordAnnotationAction(state.selectedAnnotationId))
    setState(prev => selectAnnotation(prev, null))
  }

  const clearAnnotationSelection = () => {
    setState(clearSelectedAnnotation)
  }

  useEffect(() => {
    return () => {
      webViewRef.current = null
    }
  }, [])

  return {
    session,
    enabled: state.enabled,
    // The version being annotated: the selected annotation's, else the selection's
    version: selectedAnnotationFromRedux?.version ?? state.version,
    entryVerseKey: state.entryVerseKey,
    hasSelection: state.hasSelection,
    selection: state.selection,
    clearSelectionTrigger: state.clearSelectionTrigger,
    applyAnnotationTrigger: state.applyAnnotationTrigger,
    eraseSelectionTrigger: state.eraseSelectionTrigger,
    selectedAnnotation,
    clearAnnotationSelectionTrigger: state.clearAnnotationSelectionTrigger,
    enterMode,
    exitMode,
    setWebViewRef,
    applyAnnotation,
    clearSelection,
    eraseSelection,
    handleAnnotationSelected,
    changeAnnotationColor,
    changeAnnotationType,
    deleteSelectedAnnotation,
    clearAnnotationSelection,
  }
}

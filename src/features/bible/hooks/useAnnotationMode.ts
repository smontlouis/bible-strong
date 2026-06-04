import { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Verse } from '~common/types'
import { useFeatureOnboarding, ONBOARDING_IDS } from '~features/feature-onboarding'
import {
  addWordAnnotation,
  AnnotationRange,
  removeWordAnnotationAction,
  removeWordAnnotationsInRangeAction,
  changeWordAnnotationColorAction,
  changeWordAnnotationTypeAction,
} from '~redux/modules/user/wordAnnotations'
import { VersionCode } from '~state/tabs'
import { RootState } from '~redux/modules/reducer'
import generateUUID from '~helpers/generateUUID'
import {
  INITIAL_ANNOTATION_SESSION_STATE,
  clearSelectedAnnotation,
  enterAnnotationSession,
  exitAnnotationSession,
  markAnnotationCreated,
  markAnnotationSelectionErased,
  requestApplyAnnotation,
  requestClearAnnotationSelectionRange,
  requestEraseAnnotationSelection,
  selectAnnotation,
  updateAnnotationSelection,
  type AnnotationSessionState,
  type AnnotationType,
  type SelectionRange,
  type WordPosition,
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
}

export interface AnnotationModeState {
  enabled: boolean
  version?: VersionCode
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
  enterMode: (version: VersionCode) => void
  exitMode: () => void
  setVerses: (verses: Verse[]) => void
  setWebViewRef: (ref: WebViewRef | null) => void
  applyAnnotation: (color: string, type: AnnotationType) => void
  clearSelection: () => void
  eraseSelection: () => void
  handleSelectionChanged: (hasSelection: boolean, selection: SelectionRange | null) => void
  handleCreateAnnotation: (payload: {
    ranges: { verseKey: string; startWordIndex: number; endWordIndex: number; text: string }[]
    color: string
    type: AnnotationType
  }) => void
  handleEraseSelection: (payload: { start: WordPosition; end: WordPosition }) => void
  handleAnnotationSelected: (annotationId: string | null) => void
  changeAnnotationColor: (color: string) => void
  changeAnnotationType: (type: AnnotationType) => void
  deleteSelectedAnnotation: () => void
  clearAnnotationSelection: () => void
}

export function useAnnotationMode(): UseAnnotationModeReturn {
  const [state, setState] = useState<AnnotationSessionState>(INITIAL_ANNOTATION_SESSION_STATE)
  const reduxDispatch = useDispatch()
  const versesRef = useRef<Verse[]>([])
  const webViewRef = useRef<WebViewRef | null>(null)
  const featureOnboarding = useFeatureOnboarding()

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
      text: firstRange.text,
      color: selectedAnnotationFromRedux.color,
      type: selectedAnnotationFromRedux.type,
      noteId: selectedAnnotationFromRedux.noteId,
      tags: selectedAnnotationFromRedux.tags,
    }
  })()

  const setWebViewRef = (ref: WebViewRef | null) => {
    webViewRef.current = ref
  }

  const setVerses = (verses: Verse[]) => {
    versesRef.current = verses
  }

  const enterMode = (version: VersionCode) => {
    setState(enterAnnotationSession(version))
    featureOnboarding.triggerIfNeeded(ONBOARDING_IDS.ANNOTATION_MODE)
  }

  const exitMode = () => {
    setState(exitAnnotationSession())
  }

  const handleSelectionChanged = (hasSelection: boolean, selection: SelectionRange | null) => {
    setState(prev => updateAnnotationSelection(prev, hasSelection, selection))
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

  const handleCreateAnnotation = (payload: {
    ranges: { verseKey: string; startWordIndex: number; endWordIndex: number; text: string }[]
    color: string
    type: AnnotationType
  }) => {
    if (!state.version || payload.ranges.length === 0) return

    const ranges: AnnotationRange[] = payload.ranges.map(r => ({
      verseKey: r.verseKey,
      startWordIndex: r.startWordIndex,
      endWordIndex: r.endWordIndex,
      text: r.text,
    }))

    // Generate ID before dispatch so we can use it for auto-selection
    const annotationId = generateUUID()

    reduxDispatch(
      addWordAnnotation({
        id: annotationId,
        version: state.version,
        ranges,
        color: payload.color,
        type: payload.type,
      })
    )

    setState(prev => markAnnotationCreated(prev, annotationId))
  }

  const handleEraseSelection = (payload: { start: WordPosition; end: WordPosition }) => {
    if (!state.version) return

    reduxDispatch(removeWordAnnotationsInRangeAction(state.version, payload.start, payload.end))

    setState(markAnnotationSelectionErased)
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
    enabled: state.enabled,
    version: state.version,
    hasSelection: state.hasSelection,
    selection: state.selection,
    clearSelectionTrigger: state.clearSelectionTrigger,
    applyAnnotationTrigger: state.applyAnnotationTrigger,
    eraseSelectionTrigger: state.eraseSelectionTrigger,
    selectedAnnotation,
    clearAnnotationSelectionTrigger: state.clearAnnotationSelectionTrigger,
    enterMode,
    exitMode,
    setVerses,
    setWebViewRef,
    applyAnnotation,
    clearSelection,
    eraseSelection,
    handleSelectionChanged,
    handleCreateAnnotation,
    handleEraseSelection,
    handleAnnotationSelected,
    changeAnnotationColor,
    changeAnnotationType,
    deleteSelectedAnnotation,
    clearAnnotationSelection,
  }
}

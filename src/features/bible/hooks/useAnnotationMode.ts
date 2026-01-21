import { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Verse } from '~common/types'
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

export type AnnotationType = 'background' | 'underline' | 'circle'

export interface WordPosition {
  verseKey: string
  wordIndex: number
}

export interface SelectionRange {
  start: WordPosition
  end: WordPosition
}

export interface SelectedAnnotation {
  id: string
  verseKey: string
  text: string
  color: string
  type: AnnotationType
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

const INITIAL_STATE: AnnotationModeState = {
  enabled: false,
  hasSelection: false,
  selection: null,
  clearSelectionTrigger: 0,
  applyAnnotationTrigger: { count: 0, color: '', type: 'background' },
  eraseSelectionTrigger: 0,
  selectedAnnotation: null,
  clearAnnotationSelectionTrigger: 0,
}

export function useAnnotationMode(): UseAnnotationModeReturn {
  const [state, setState] = useState<AnnotationModeState>(INITIAL_STATE)
  const reduxDispatch = useDispatch()
  const versesRef = useRef<Verse[]>([])
  const webViewRef = useRef<WebViewRef | null>(null)

  const setWebViewRef = (ref: WebViewRef | null) => {
    webViewRef.current = ref
  }

  const setVerses = (verses: Verse[]) => {
    versesRef.current = verses
  }

  const enterMode = (version: VersionCode) => {
    setState({
      ...INITIAL_STATE,
      enabled: true,
      version,
    })
  }

  const exitMode = () => {
    setState(INITIAL_STATE)
  }

  const handleSelectionChanged = (hasSelection: boolean, selection: SelectionRange | null) => {
    setState(prev => ({
      ...prev,
      hasSelection,
      selection,
    }))
  }

  const applyAnnotation = (color: string, type: AnnotationType) => {
    if (!state.hasSelection) return

    setState(prev => ({
      ...prev,
      applyAnnotationTrigger: {
        count: (prev.applyAnnotationTrigger?.count ?? 0) + 1,
        color,
        type,
      },
    }))
  }

  const clearSelection = () => {
    setState(prev => ({
      ...prev,
      hasSelection: false,
      selection: null,
      clearSelectionTrigger: (prev.clearSelectionTrigger ?? 0) + 1,
    }))
  }

  const eraseSelection = () => {
    if (!state.hasSelection) return

    setState(prev => ({
      ...prev,
      eraseSelectionTrigger: (prev.eraseSelectionTrigger ?? 0) + 1,
    }))
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

    reduxDispatch(
      addWordAnnotation({
        version: state.version,
        ranges,
        color: payload.color,
        type: payload.type,
      })
    )

    setState(prev => ({
      ...prev,
      hasSelection: false,
      selection: null,
    }))
  }

  const handleEraseSelection = (payload: { start: WordPosition; end: WordPosition }) => {
    if (!state.version) return

    reduxDispatch(removeWordAnnotationsInRangeAction(state.version, payload.start, payload.end))

    setState(prev => ({
      ...prev,
      hasSelection: false,
      selection: null,
    }))
  }

  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)

  const handleAnnotationSelected = (annotationId: string | null) => {
    if (!annotationId) {
      setState(prev => ({ ...prev, selectedAnnotation: null }))
      return
    }

    const annotation = wordAnnotations?.[annotationId]
    if (!annotation) {
      setState(prev => ({ ...prev, selectedAnnotation: null }))
      return
    }

    const firstRange = annotation.ranges[0]
    setState(prev => ({
      ...prev,
      selectedAnnotation: {
        id: annotationId,
        verseKey: firstRange.verseKey,
        text: firstRange.text,
        color: annotation.color,
        type: annotation.type,
      },
      hasSelection: false,
      selection: null,
    }))
  }

  const changeAnnotationColor = (color: string) => {
    if (!state.selectedAnnotation) return
    reduxDispatch(changeWordAnnotationColorAction(state.selectedAnnotation.id, color))
    setState(prev => ({
      ...prev,
      selectedAnnotation: prev.selectedAnnotation ? { ...prev.selectedAnnotation, color } : null,
    }))
  }

  const changeAnnotationType = (type: AnnotationType) => {
    if (!state.selectedAnnotation) return
    reduxDispatch(changeWordAnnotationTypeAction(state.selectedAnnotation.id, type))
    setState(prev => ({
      ...prev,
      selectedAnnotation: prev.selectedAnnotation ? { ...prev.selectedAnnotation, type } : null,
    }))
  }

  const deleteSelectedAnnotation = () => {
    if (!state.selectedAnnotation) return
    reduxDispatch(removeWordAnnotationAction(state.selectedAnnotation.id))
    setState(prev => ({ ...prev, selectedAnnotation: null }))
  }

  const clearAnnotationSelection = () => {
    setState(prev => ({
      ...prev,
      selectedAnnotation: null,
      clearAnnotationSelectionTrigger: (prev.clearAnnotationSelectionTrigger ?? 0) + 1,
    }))
  }

  useEffect(() => {
    return () => {
      webViewRef.current = null
    }
  }, [])

  return {
    ...state,
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

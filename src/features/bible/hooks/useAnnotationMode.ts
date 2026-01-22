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
import generateUUID from '~helpers/generateUUID'

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
  noteId?: string
  tags?: { [id: string]: { id: string; name: string } }
}

interface AnnotationModeInternalState {
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
  selectedAnnotationId: string | null
  clearAnnotationSelectionTrigger: number
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

const INITIAL_STATE: AnnotationModeInternalState = {
  enabled: false,
  hasSelection: false,
  selection: null,
  clearSelectionTrigger: 0,
  applyAnnotationTrigger: { count: 0, color: '', type: 'background' },
  eraseSelectionTrigger: 0,
  selectedAnnotationId: null,
  clearAnnotationSelectionTrigger: 0,
}

export function useAnnotationMode(): UseAnnotationModeReturn {
  const [state, setState] = useState<AnnotationModeInternalState>(INITIAL_STATE)
  const reduxDispatch = useDispatch()
  const versesRef = useRef<Verse[]>([])
  const webViewRef = useRef<WebViewRef | null>(null)

  // Get word annotations from Redux - single source of truth
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)

  // Derive selectedAnnotation from Redux based on selectedAnnotationId
  const deriveSelectedAnnotation = (): SelectedAnnotation | null => {
    if (!state.selectedAnnotationId) return null

    const annotation = wordAnnotations?.[state.selectedAnnotationId]
    if (!annotation) return null

    const firstRange = annotation.ranges[0]
    if (!firstRange) return null

    return {
      id: state.selectedAnnotationId,
      verseKey: firstRange.verseKey,
      text: firstRange.text,
      color: annotation.color,
      type: annotation.type,
      noteId: annotation.noteId,
      tags: annotation.tags,
    }
  }

  const selectedAnnotation = deriveSelectedAnnotation()

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

    // Auto-select the newly created annotation
    setState(prev => ({
      ...prev,
      hasSelection: false,
      selection: null,
      selectedAnnotationId: annotationId,
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

  const handleAnnotationSelected = (annotationId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedAnnotationId: annotationId,
      hasSelection: false,
      selection: null,
    }))
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
    setState(prev => ({ ...prev, selectedAnnotationId: null }))
  }

  const clearAnnotationSelection = () => {
    setState(prev => ({
      ...prev,
      selectedAnnotationId: null,
      clearAnnotationSelectionTrigger: (prev.clearAnnotationSelectionTrigger ?? 0) + 1,
    }))
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

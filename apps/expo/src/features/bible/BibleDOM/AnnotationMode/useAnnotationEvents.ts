'use dom'

import { useEffect } from 'react'
import { Verse as TVerse } from '~common/types'
import { WordToken } from '~helpers/wordTokenizer'
import { Dispatch } from '../BibleDOMWrapper'
import { AnnotationType } from './HighlightComponents'
import { SelectionRange, normalizeRange, buildRangesFromSelection } from './selectionUtils'

export interface AnnotationEventsConfig {
  selection: SelectionRange | null
  setSelection: (value: SelectionRange | null) => void
  versesByVersion: Record<string, TVerse[]>
  dispatch: Dispatch
  getTokens: (verseKey: string, text: string) => WordToken[]
  // Triggers from props
  clearSelectionTrigger?: number
  applyAnnotationTrigger?: { count: number; color: string; type: AnnotationType }
  eraseSelectionTrigger?: number
}

export function useAnnotationEvents({
  selection,
  setSelection,
  versesByVersion,
  dispatch,
  getTokens,
  clearSelectionTrigger,
  applyAnnotationTrigger,
  eraseSelectionTrigger,
}: AnnotationEventsConfig): void {
  // The annotation is saved for the version its words were selected in.
  const createAnnotation = (selection: SelectionRange, color: string, type: AnnotationType) => {
    const verses = versesByVersion[selection.version] ?? []
    const ranges = buildRangesFromSelection(selection, verses, getTokens)

    if (ranges.length > 0) {
      dispatch({
        type: 'CREATE_ANNOTATION',
        payload: { ranges, color, type, version: selection.version },
      }).catch(console.error)
    }
  }

  const eraseSelection = (selection: SelectionRange) => {
    const { start, end } = normalizeRange(selection, versesByVersion[selection.version] ?? [])

    dispatch({
      type: 'ERASE_SELECTION',
      payload: { start, end, version: selection.version },
    }).catch(console.error)
  }

  // Window event: applyAnnotation
  useEffect(() => {
    const handleApplyAnnotation = (e: Event) => {
      const customEvent = e as CustomEvent<{ color: string; type: AnnotationType }>
      if (!selection) return

      const { color, type } = customEvent.detail
      createAnnotation(selection, color, type)

      setSelection(null)
    }

    window.addEventListener('applyAnnotation', handleApplyAnnotation)
    return () => window.removeEventListener('applyAnnotation', handleApplyAnnotation)
  }, [selection, versesByVersion, dispatch])

  // Window event: eraseSelection
  useEffect(() => {
    const handleEraseSelection = () => {
      if (!selection) return

      eraseSelection(selection)
      setSelection(null)
    }

    window.addEventListener('eraseSelection', handleEraseSelection)
    return () => window.removeEventListener('eraseSelection', handleEraseSelection)
  }, [selection, versesByVersion, dispatch])

  // Window event: clearSelection
  useEffect(() => {
    const handleClearSelection = () => setSelection(null)
    window.addEventListener('clearSelection', handleClearSelection)
    return () => window.removeEventListener('clearSelection', handleClearSelection)
  }, [])

  // Prop trigger: clearSelectionTrigger
  useEffect(() => {
    if (clearSelectionTrigger && clearSelectionTrigger > 0) {
      setSelection(null)
    }
  }, [clearSelectionTrigger])

  // Prop trigger: applyAnnotationTrigger
  useEffect(() => {
    if (!applyAnnotationTrigger || applyAnnotationTrigger.count === 0) return
    if (!selection) return

    const { color, type } = applyAnnotationTrigger
    createAnnotation(selection, color, type)
    setSelection(null)
  }, [applyAnnotationTrigger?.count])

  // Prop trigger: eraseSelectionTrigger
  useEffect(() => {
    if (!eraseSelectionTrigger || eraseSelectionTrigger === 0) return
    if (!selection) return

    eraseSelection(selection)
    setSelection(null)
  }, [eraseSelectionTrigger])
}

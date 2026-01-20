'use dom'

import { styled, keyframes } from 'goober'
import { useEffect, useState, useRef } from 'react'
import { useFonts } from 'expo-font'
import { Verse as TVerse } from '~common/types'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import {
  tokenizeVerseText,
  getWordIndexFromCharOffset,
  getTokenByWordIndex,
  WordToken,
} from '~helpers/wordTokenizer'
import { Dispatch, PericopeChapter, RootStyles, WebViewProps } from '../BibleDOMWrapper'
import { DispatchProvider } from '../DispatchProvider'
import { TranslationsProvider, BibleDOMTranslations } from '../TranslationsContext'
import {
  HighlightLayer,
  HighlightRectDiv,
  HighlightRect,
  AnnotationType,
  getAnimationDelay,
} from './HighlightComponents'
import { SelectionRange, normalizeRange, getVersesBetween } from './selectionUtils'
import { getCaretInfoFromPoint } from './domUtils'
import { useTouchSelection } from './useTouchSelection'
import { useWindowEvents } from './useWindowEvents'
import { useAnnotationEvents } from './useAnnotationEvents'
import { VerseItem } from './VerseItem'
import { SelectionHandles } from './SelectionHandles'

export type { AnnotationType } from './HighlightComponents'

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`

const Container = styled('div')<RootStyles & { rtl: boolean }>(
  ({ settings: { alignContent, theme, colors }, rtl }) => ({
    position: 'relative',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '10px 15px',
    paddingBottom: '300px',
    textAlign: alignContent,
    background: colors[theme].reverse,
    color: colors[theme].default,
    direction: rtl ? 'rtl' : 'ltr',
    paddingTop: `${HEADER_HEIGHT + 10}px`,
    animation: `${fadeIn} 0.8s ease-out`,
    ...(rtl ? { textAlign: 'right' } : {}),
  })
)

export type AnnotationModeProps = {
  verses: TVerse[]
  settings: RootStyles['settings']
  dispatch: Dispatch
  translations: BibleDOMTranslations
  wordAnnotations: WebViewProps['wordAnnotations']
  version: string
  pericopeChapter: PericopeChapter
  clearSelectionTrigger?: number
  applyAnnotationTrigger?: { count: number; color: string; type: AnnotationType }
  eraseSelectionTrigger?: number
  clearAnnotationSelectionTrigger?: number
  selectedAnnotationId?: string | null
  // Safe area inset from native side (CSS env vars don't work in Expo DOM WebView)
  safeAreaTop?: number
}

const AnnotationModeRenderer = ({
  verses,
  settings,
  dispatch,
  translations,
  wordAnnotations,
  version,
  pericopeChapter,
  clearSelectionTrigger,
  applyAnnotationTrigger,
  eraseSelectionTrigger,
  selectedAnnotationId,
  safeAreaTop = 0,
}: AnnotationModeProps) => {
  const [_loaded] = useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

  const [selection, setSelection] = useState<SelectionRange | null>(null)
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [tokensCache] = useState<Map<string, WordToken[]>>(() => new Map())

  const isHebreu =
    version === 'BHS' ||
    ((version === 'INT' || version === 'INT_EN') && Number(verses[0]?.Livre) < 40)

  const getTokens = (verseKey: string, text: string): WordToken[] => {
    if (!tokensCache.has(verseKey)) {
      tokensCache.set(verseKey, tokenizeVerseText(text))
    }
    return tokensCache.get(verseKey)!
  }

  const getRectsForRange = (
    range: SelectionRange,
    color: string,
    type: 'selection' | 'annotation',
    annotationType?: AnnotationType,
    idPrefix?: string,
    annotationId?: string
  ): HighlightRect[] => {
    const rects: HighlightRect[] = []
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return rects

    const { start: normalizedStart, end: normalizedEnd } = normalizeRange(range, verses)

    const versesToHighlight = getVersesBetween(
      verses,
      normalizedStart.verseKey,
      normalizedEnd.verseKey
    )

    versesToHighlight.forEach((verse, idx) => {
      if (verse.Verset === 0) return

      const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
      const verseEl = document.getElementById(`verse-text-${verseKey}`)
      if (!verseEl?.firstChild) return

      const tokens = getTokens(verseKey, verse.Texte)
      const wordTokens = tokens.filter(t => !t.isWhitespace)
      if (wordTokens.length === 0) return

      const isFirst = idx === 0
      const isLast = idx === versesToHighlight.length - 1

      const startWordIdx = isFirst ? normalizedStart.wordIndex : 0
      const endWordIdx = isLast ? normalizedEnd.wordIndex : wordTokens[wordTokens.length - 1].index

      const startToken = getTokenByWordIndex(tokens, startWordIdx)
      const endToken = getTokenByWordIndex(tokens, endWordIdx)
      if (!startToken || !endToken) return

      const textNode = verseEl.firstChild
      if (textNode.nodeType !== Node.TEXT_NODE) return

      const textLength = textNode.textContent?.length || 0
      try {
        const domRange = document.createRange()
        domRange.setStart(textNode, Math.min(startToken.charStart, textLength))
        domRange.setEnd(textNode, Math.min(endToken.charEnd, textLength))

        const clientRects = domRange.getClientRects()

        Array.from(clientRects).forEach((rect, rectIdx) => {
          const prefix = idPrefix || `${type}-${verseKey}`
          rects.push({
            id: `${prefix}-${rectIdx}`,
            top: rect.top - containerRect.top,
            left: rect.left - containerRect.left,
            width: rect.width,
            height: rect.height,
            color,
            type,
            annotationType,
            annotationId,
          })
        })
      } catch (e) {
        console.error('[Bible] Error calculating rects:', e)
      }
    })

    return rects
  }

  const calculateHighlightRects = (): HighlightRect[] => {
    const rects: HighlightRect[] = []
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return rects

    if (selection) {
      const selectionRects = getRectsForRange(selection, 'rgba(0, 122, 255, 0.3)', 'selection')
      rects.push(...selectionRects)
    }

    if (wordAnnotations) {
      Object.entries(wordAnnotations).forEach(([id, annotation]) => {
        if (annotation.version !== version) return

        annotation.ranges.forEach((range, idx) => {
          const selRange: SelectionRange = {
            start: { verseKey: range.verseKey, wordIndex: range.startWordIndex },
            end: { verseKey: range.verseKey, wordIndex: range.endWordIndex },
          }

          const colorValue =
            settings.colors[settings.theme][
              annotation.color as keyof (typeof settings.colors)[typeof settings.theme]
            ] || annotation.color

          const annotationRects = getRectsForRange(
            selRange,
            colorValue as string,
            'annotation',
            annotation.type,
            `${id}-${idx}`,
            id
          )
          rects.push(...annotationRects)
        })
      })
    }

    return rects
  }

  // Calculate selection handle positions from highlight rects
  const getSelectionHandlePositions = (): {
    start: { x: number; y: number } | null
    end: { x: number; y: number } | null
  } => {
    const selectionRects = highlightRects.filter(r => r.type === 'selection')
    if (selectionRects.length === 0) return { start: null, end: null }

    // Read direction from DOM
    const isRTL = containerRef.current
      ? getComputedStyle(containerRef.current).direction === 'rtl'
      : false

    // Sort rects by position (top to bottom, then left to right for LTR, right to left for RTL)
    const sortedRects = [...selectionRects].sort((a, b) => {
      if (Math.abs(a.top - b.top) > 5) return a.top - b.top
      return isRTL ? b.left - a.left : a.left - b.left
    })

    const firstRect = sortedRects[0]
    const lastRect = sortedRects[sortedRects.length - 1]

    return {
      start: isRTL
        ? { x: firstRect.left + firstRect.width, y: firstRect.top }
        : { x: firstRect.left, y: firstRect.top },
      end: isRTL
        ? { x: lastRect.left, y: lastRect.top + lastRect.height }
        : { x: lastRect.left + lastRect.width, y: lastRect.top + lastRect.height },
    }
  }

  const handleVerseClick = (e: React.MouseEvent, verseKey: string, tokens: WordToken[]) => {
    // Ignore click right after a drag to prevent synthetic click events
    if (Date.now() - lastDragEndRef.current < 150) {
      return
    }

    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const clickX = e.clientX - containerRect.left
    const clickY = e.clientY - containerRect.top

    // Check if clicked on an annotation
    const clickedAnnotationRect = highlightRects.find(
      rect =>
        rect.type === 'annotation' &&
        rect.annotationId &&
        clickX >= rect.left &&
        clickX <= rect.left + rect.width &&
        clickY >= rect.top &&
        clickY <= rect.top + rect.height
    )

    if (clickedAnnotationRect?.annotationId) {
      setSelection(null)
      const newAnnotationId =
        clickedAnnotationRect.annotationId === selectedAnnotationId
          ? null
          : clickedAnnotationRect.annotationId
      dispatch({
        type: 'ANNOTATION_SELECTED',
        payload: { annotationId: newAnnotationId },
      }).catch(console.error)
      return
    }

    // Check if clicked inside current selection
    const clickedInsideSelection = highlightRects.some(
      rect =>
        rect.type === 'selection' &&
        clickX >= rect.left &&
        clickX <= rect.left + rect.width &&
        clickY >= rect.top &&
        clickY <= rect.top + rect.height
    )

    if (clickedInsideSelection) {
      return // Don't clear selection if clicking inside it
    }

    // Clear annotation selection if any
    if (selectedAnnotationId) {
      dispatch({
        type: 'ANNOTATION_SELECTED',
        payload: { annotationId: null },
      }).catch(console.error)
    }

    // If there's already a selection, clear it
    if (selection) {
      setSelection(null)
      return
    }

    // No selection exists → create one on the clicked word
    const caretInfo = getCaretInfoFromPoint(e.clientX, e.clientY, safeAreaTop)
    if (!caretInfo) return

    const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)
    if (wordIndex === null) return

    setSelection({
      start: { verseKey, wordIndex },
      end: { verseKey, wordIndex },
    })
  }

  // Touch selection hook
  const { lastDragEndRef } = useTouchSelection({
    containerRef,
    selection,
    setSelection: fn => setSelection(fn),
    verses,
    getTokens,
    getSelectionHandlePositions,
    highlightRects,
    safeAreaTop,
    onDragStart: () => {
      if (selectedAnnotationId) {
        dispatch({
          type: 'ANNOTATION_SELECTED',
          payload: { annotationId: null },
        }).catch(console.error)
      }
    },
  })

  // Window events hook (scroll, resize)
  useWindowEvents(calculateHighlightRects, setHighlightRects, [
    selection,
    wordAnnotations,
    version,
    verses,
    settings,
  ])

  // Annotation events hook
  useAnnotationEvents({
    selection,
    setSelection,
    verses,
    dispatch,
    getTokens,
    clearSelectionTrigger,
    applyAnnotationTrigger,
    eraseSelectionTrigger,
  })

  // Mount effect
  useEffect(() => {
    console.log('[Bible] WEB: Annotation mode mounted (Positioned Divs)')
    dispatch({ type: 'DOM_COMPONENT_MOUNTED' }).catch(console.error)
    document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT}px`)
  }, [])

  // Theme effect
  useEffect(() => {
    if (settings?.theme) {
      document.body.style.backgroundColor = settings.colors[settings.theme].reverse
    }
  }, [settings?.theme])

  // Selection changed notification
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch({
        type: 'SELECTION_CHANGED',
        payload: { hasSelection: selection !== null, selection },
      }).catch(console.error)
    }, 50)

    return () => clearTimeout(timeoutId)
  }, [selection])

  // Get selection handle positions for rendering
  const handlePositions = getSelectionHandlePositions()

  return (
    <TranslationsProvider translations={translations}>
      <DispatchProvider dispatch={dispatch}>
        <Container ref={containerRef} settings={settings} rtl={isHebreu}>
          <HighlightLayer>
            {highlightRects.map((rect, index) => (
              <HighlightRectDiv
                key={rect.id}
                $top={rect.top}
                $left={rect.left}
                $width={rect.width}
                $height={rect.height}
                $color={rect.color}
                $annotationType={rect.annotationType}
                $isSelected={rect.annotationId === selectedAnnotationId}
                $primaryColor={settings.colors[settings.theme].primary}
                $backgroundColor={settings.colors[settings.theme].reverse}
                $animationDelay={rect.type === 'annotation' ? getAnimationDelay(rect.id) : 0}
              />
            ))}
            <SelectionHandles
              hasSelection={selection !== null}
              startPosition={handlePositions.start}
              endPosition={handlePositions.end}
            />
          </HighlightLayer>

          {verses.map(verse => {
            const { Livre, Chapitre, Verset, Texte } = verse
            const verseKey = `${Livre}-${Chapitre}-${Verset}`
            const tokens = getTokens(verseKey, Texte)

            return (
              <VerseItem
                key={verseKey}
                verse={verse}
                verseKey={verseKey}
                tokens={tokens}
                settings={settings}
                pericopeChapter={pericopeChapter}
                onVerseClick={handleVerseClick}
              />
            )
          })}
        </Container>
      </DispatchProvider>
    </TranslationsProvider>
  )
}

export default AnnotationModeRenderer

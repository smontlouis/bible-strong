import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { SheetRef } from '~common/sheet'
import type { Verse } from '~common/types'
import { twMerge } from '~common/ui/classNames'
import { HStack, TouchableBox } from '~common/ui/Box'
import verseToReference from '~helpers/verseToReference'
import { useResolvedColor } from '~helpers/useHighlightColors'
import { useTheme } from '~themes/ThemeProvider'
import AnnotationPreview from './AnnotationPreview'
import {
  getAnnotationWordRanges,
  getSelectionWordRanges,
  getWordRangesVerseKeys,
} from './annotationWords'
import type { AnnotationType, SelectedAnnotation, SelectionRange } from './hooks/useAnnotationMode'

export type AnnotationToolbarProps = {
  ref?: RefObject<SheetRef | null>
  hasSelection: boolean
  selection?: SelectionRange | null
  onApplyAnnotation: (color: string, type: AnnotationType) => void
  onClearSelection: () => void
  onEraseAnnotations: () => void
  onClose: () => void
  selectedAnnotation?: SelectedAnnotation | null
  onChangeAnnotationColor?: (color: string) => void
  onChangeAnnotationType?: (type: AnnotationType) => void
  onDeleteAnnotation?: () => void
  onClearAnnotationSelection?: () => void
  onNotePress?: () => void
  onTagsPress?: () => void
  onRelationsPress?: () => void
  tagsCount?: number
  relationsCount?: number
  /** The version the session annotates, named beside the reference: annotations belong to it alone. */
  annotatedVersion?: string
  /** Desktop menu: the verse the session started from, where the menu opens until words are chosen. */
  entryVerseKey?: string
  isEnabled: boolean
  /** The verses of the annotated version on screen, where the words' text is read. */
  verses?: Verse[]
  focusVerses?: (string | number)[]
  /** Holds the verses of the words in the reader's focus, where their study gathers. */
  onFocusVerses?: (verseKeys: string[]) => void
  /** Annotates the selected words with the last mark used, which then becomes the open annotation. */
  onAnnotateWords?: () => void
}

type AnnotationAction = 'note' | 'tags' | 'relations'

const formatSelectionRange = (selection: SelectionRange): string => {
  const [startBook, startChapter, startVerseNumber] = selection.start.verseKey
    .split('-')
    .map(Number)
  const [endBook, endChapter, endVerseNumber] = selection.end.verseKey.split('-').map(Number)

  if (startBook !== endBook || startChapter !== endChapter) {
    return verseToReference([selection.start.verseKey, selection.end.verseKey])
  }

  // Normalize: ensure startVerse <= endVerse (handles right-to-left selection)
  const startVerse = Math.min(startVerseNumber, endVerseNumber)
  const endVerse = Math.max(startVerseNumber, endVerseNumber)

  const verses = Array.from(
    { length: endVerse - startVerse + 1 },
    (_, i) => `${startBook}-${startChapter}-${startVerse + i}`
  )

  return verseToReference(verses)
}

/**
 * The state the sheet and the desktop menu share: what is enabled, the type being chosen, the
 * words. A note, tags or relations asked for words not annotated yet annotate them first, then
 * open on the new annotation. The desktop menu opens the tags in a screen of its own (`openTags`).
 */
export function useAnnotationTools(
  props: AnnotationToolbarProps,
  { openTags }: { openTags?: () => void } = {}
) {
  const {
    hasSelection,
    selection,
    isEnabled,
    selectedAnnotation,
    onApplyAnnotation,
    onChangeAnnotationColor,
    onChangeAnnotationType,
    onNotePress,
    onTagsPress,
    onRelationsPress,
    onDeleteAnnotation,
    onEraseAnnotations,
    verses = [],
    focusVerses,
    onAnnotateWords,
  } = props
  const theme = useTheme()
  const [annotationTypeSelection, setAnnotationTypeSelection] = useState<{
    annotationId?: string
    type: AnnotationType
  }>({ annotationId: selectedAnnotation?.id, type: selectedAnnotation?.type ?? 'background' })
  const activeAnnotationType =
    annotationTypeSelection.annotationId === selectedAnnotation?.id
      ? annotationTypeSelection.type
      : (selectedAnnotation?.type ?? 'background')
  const setActiveAnnotationType = (type: AnnotationType) => {
    setAnnotationTypeSelection({ annotationId: selectedAnnotation?.id, type })
  }

  const resolvedColor = useResolvedColor(selectedAnnotation?.color ?? 'color1')
  const hasWords = !!selectedAnnotation || hasSelection
  const wordRanges = selectedAnnotation
    ? getAnnotationWordRanges(selectedAnnotation.ranges, verses)
    : selection
      ? getSelectionWordRanges(selection, verses)
      : []
  const verseKeys = getWordRangesVerseKeys(wordRanges)
  const focusedVerses = (focusVerses ?? []).map(String)

  const act = (action: AnnotationAction) => {
    if (action === 'note') onNotePress?.()
    else if (action === 'tags') (openTags ?? onTagsPress)?.()
    else onRelationsPress?.()
  }
  // The action asked for words not annotated yet waits for their annotation to open.
  const pendingAction = useRef<AnnotationAction | null>(null)
  const runPendingAction = useEffectEvent((action: AnnotationAction) => act(action))
  const selectedAnnotationId = selectedAnnotation?.id
  useEffect(() => {
    const action = pendingAction.current
    if (!action || !selectedAnnotationId) return
    pendingAction.current = null
    runPendingAction(action)
  }, [selectedAnnotationId])
  const runOnAnnotation = (action: AnnotationAction) => {
    if (selectedAnnotation) return act(action)
    if (!hasSelection || !onAnnotateWords) return
    pendingAction.current = action
    onAnnotateWords()
  }

  const canAnnotate = !!selectedAnnotation || (hasSelection && !!onAnnotateWords)

  return {
    disabled: !isEnabled || !hasWords,
    noteDisabled: !isEnabled || !canAnnotate || !onNotePress,
    tagsDisabled: !isEnabled || !canAnnotate || !(openTags ?? onTagsPress),
    relationsDisabled: !isEnabled || !canAnnotate || !onRelationsPress,
    openNote: () => runOnAnnotation('note'),
    openTags: () => runOnAnnotation('tags'),
    openRelations: () => runOnAnnotation('relations'),
    /** Deletes the open annotation, or erases those under the selected words. */
    erase: !isEnabled
      ? undefined
      : selectedAnnotation
        ? onDeleteAnnotation
        : hasSelection
          ? onEraseAnnotations
          : undefined,
    wordRanges,
    verseKeys,
    hasFocus:
      focusedVerses.length > 0 &&
      verseKeys.some(verseKey => focusedVerses.includes(verseKey.split('-')[2])),
    reference: verseKeys.length
      ? verseToReference(verseKeys)
      : selectedAnnotation
        ? verseToReference([selectedAnnotation.verseKey])
        : selection
          ? formatSelectionRange(selection)
          : null,
    activeAnnotationType,
    setActiveAnnotationType,
    getColor: (type: AnnotationType) =>
      selectedAnnotation?.type === type ? resolvedColor : theme.colors.grey,
    selectedColor:
      selectedAnnotation?.type === activeAnnotationType ? selectedAnnotation.color : undefined,
    apply: (color: string, type: AnnotationType) => {
      if (selectedAnnotation) {
        onChangeAnnotationColor?.(color)
        onChangeAnnotationType?.(type)
      } else {
        onApplyAnnotation(color, type)
      }
    },
  }
}

/**
 * The three ways to mark words, side by side as a segmented control: each shows its mark in the
 * open annotation's color, the chosen one stands out on its track.
 */
export const AnnotationTypeSwitch = ({
  disabled,
  activeType,
  onChange,
  getColor,
  compact,
}: {
  disabled: boolean
  activeType: AnnotationType
  onChange: (type: AnnotationType) => void
  getColor: (type: AnnotationType) => string
  /** The desktop menu's smaller control. */
  compact?: boolean
}) => {
  const typeLabels = useAnnotationTypeLabels()
  return (
    <HStack
      className={twMerge(
        'bg-light-grey rounded-full p-[3px] gap-[2px]',
        compact ? 'w-[120px]' : 'w-[138px]'
      )}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {typeLabels.map(({ type, label }) => {
        const isActive = !disabled && activeType === type
        return (
          <TouchableBox
            key={type}
            className={twMerge(
              'flex-1 min-w-0 items-center justify-center rounded-full',
              compact ? 'h-[28px]' : 'h-[38px]',
              isActive && 'bg-surface-raised'
            )}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled, selected: isActive }}
            disabled={disabled}
            onPress={() => onChange(type)}
          >
            <AnnotationPreview small type={type} color={getColor(type)} />
          </TouchableBox>
        )
      })}
    </HStack>
  )
}

/** The three ways to mark words, as the sheet and the desktop menu list them. */
export const useAnnotationTypeLabels = () => {
  const { t } = useTranslation()
  return [
    { type: 'background', label: t('Surligner') },
    { type: 'underline', label: t('Souligner') },
    { type: 'circle', label: t('Entourer') },
  ] as const
}

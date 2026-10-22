import { useSetAtom } from 'jotai/react'
import { useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { SheetRef } from '~common/sheet'
import { twMerge } from '~common/ui/classNames'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import verseToReference from '~helpers/verseToReference'
import { useColorItems, useResolvedColor } from '~helpers/useHighlightColors'
import { colorPickerModalAtom } from 'src/state/app'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
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
}

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

/** The state the sheet and the desktop menu share: what is enabled, the type being chosen. */
export function useAnnotationTools({
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
}: AnnotationToolbarProps) {
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

  return {
    disabled: !isEnabled || (!selectedAnnotation && !hasSelection),
    noteDisabled: !isEnabled || !selectedAnnotation || !onNotePress,
    tagsDisabled: !isEnabled || !selectedAnnotation || !onTagsPress,
    relationsDisabled: !isEnabled || !selectedAnnotation || !onRelationsPress,
    reference: selectedAnnotation
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

type AnnotationTypeButtonProps = {
  disabled: boolean
  type: AnnotationType
  activeType: AnnotationType
  onPress: (type: AnnotationType) => void
  children: ReactNode
  label: string
  /** The desktop menu's smaller tile. */
  compact?: boolean
}

export const AnnotationTypeButton = ({
  disabled,
  type,
  activeType,
  onPress,
  children,
  label,
  compact,
}: AnnotationTypeButtonProps) => {
  const theme = useTheme()
  return (
    <TouchableBox
      className={twMerge(
        'flex-1 min-w-0 items-center justify-center',
        compact
          ? 'gap-[2px] min-h-[58px] px-[2px] py-[6px] rounded-[8px]'
          : 'gap-[6px] min-h-[75px] px-[4px] py-[10px] rounded-[12px]'
      )}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: !disabled && activeType === type }}
      disabled={disabled}
      onPress={() => onPress(type)}
      style={{
        opacity: disabled ? 0.5 : 1,
        // The chosen type takes a tint, not an outline.
        backgroundColor:
          !disabled && activeType === type
            ? colorWithOpacity(theme.colors.primary, 0.12)
            : undefined,
      }}
    >
      {children}
      <Text
        className={twMerge(
          compact ? 'text-[12px]' : 'text-[13px]',
          !disabled && activeType === type ? 'text-primary font-bold' : 'text-default'
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableBox>
  )
}

type AnnotationColorPaletteProps = {
  type: AnnotationType
  selectedColor?: string
  onSelectColor: (colorKey: string, type: AnnotationType) => void
}

export const AnnotationColorPalette = ({
  type,
  selectedColor,
  onSelectColor,
}: AnnotationColorPaletteProps) => {
  const colorItems = useColorItems()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)

  return (
    <HStack className="overflow-hidden border-continuous items-center justify-center gap-[8px] flex-wrap py-[14px] px-[16px]">
      {colorItems.map(color => (
        <TouchableBox
          className="border-continuous overflow-hidden rounded-full items-center justify-center border-primary"
          key={color.key}
          onPress={() => onSelectColor(color.key, type)}
          style={{ borderWidth: selectedColor === color.key ? 2 : 0, width: 36, height: 36 }}
        >
          <Box
            className="overflow-hidden border-continuous rounded-full"
            style={[
              {
                width: selectedColor === color.key ? 26 : 28,
                height: selectedColor === color.key ? 26 : 28,
              },
              { backgroundColor: color.hex },
            ]}
          />
        </TouchableBox>
      ))}
      <TouchableBox
        className="overflow-hidden border-continuous rounded-full items-center justify-center bg-opacity5"
        onPress={() => {
          setColorPickerModal({
            selectedColor,
            onSelectColor: colorKey => onSelectColor(colorKey, type),
          })
        }}
        style={{ width: 36, height: 36 }}
      >
        <FeatherIcon name="plus" size={16} color="primary" />
      </TouchableBox>
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

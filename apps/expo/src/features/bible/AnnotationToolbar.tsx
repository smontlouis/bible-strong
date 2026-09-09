import { twMerge } from '~common/ui/classNames'
import { useTheme } from '~themes/ThemeProvider'
import { type SheetRef, SheetView } from '~common/sheet'
import Sheet from './SelectedVersesModal/SelectionSheet'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import AnnotationPreview from './AnnotationPreview'
import Box, { AnimatedBox, HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import verseToReference from '~helpers/verseToReference'
import { colorPickerModalAtom } from 'src/state/app'
import type { AnnotationType, SelectionRange } from './hooks/useAnnotationMode'
import { LinearTransition } from 'react-native-reanimated'
import { useColorItems, useResolvedColor } from '~helpers/useHighlightColors'
interface SelectedAnnotation {
  id: string
  verseKey: string
  text: string
  color: string
  type: AnnotationType
  noteId?: string
  tags?: { [id: string]: { id: string; name: string } }
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

type Props = {
  ref?: React.RefObject<SheetRef | null>
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
  isEnabled: boolean
}

type AnnotationTypeButtonProps = {
  disabled: boolean
  type: AnnotationType
  activeType: AnnotationType
  onPress: (type: AnnotationType) => void
  children: React.ReactNode
  label: string
}

const AnnotationTypeButton = ({
  disabled,
  type,
  activeType,
  onPress,
  children,
  label,
}: AnnotationTypeButtonProps) => (
  <TouchableBox
    className={twMerge(
      'flex-1 min-w-0 items-center justify-center gap-[6px] min-h-[75px] px-[4px] py-[10px] rounded-[12px] border',
      !disabled && activeType === type ? 'border-primary bg-light-grey' : 'border-border'
    )}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled, selected: !disabled && activeType === type }}
    disabled={disabled}
    onPress={() => onPress(type)}
    style={{ opacity: disabled ? 0.5 : 1 }}
  >
    {children}
    <Text
      className={twMerge(
        'text-[13px]',
        !disabled && activeType === type ? 'text-primary font-bold' : 'text-default'
      )}
      numberOfLines={1}
    >
      {label}
    </Text>
  </TouchableBox>
)

type AnnotationColorPaletteProps = {
  disabled: boolean
  type: AnnotationType
  selectedColor?: string
  onSelectColor: (colorKey: string, type: AnnotationType) => void
}

const AnnotationColorPalette = ({
  disabled,
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
        className="overflow-hidden border-continuous rounded-[15px] items-center justify-center bg-opacity5"
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

const AnnotationToolbar = ({
  ref,
  hasSelection,
  selection,
  onApplyAnnotation,
  onClearSelection,
  onEraseAnnotations,
  onClose,
  selectedAnnotation,
  onChangeAnnotationColor,
  onChangeAnnotationType,
  onDeleteAnnotation,
  onClearAnnotationSelection,
  onNotePress,
  onTagsPress,
  onRelationsPress,
  tagsCount = 0,
  relationsCount = 0,
  isEnabled,
}: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const disabled = !isEnabled || (!selectedAnnotation && !hasSelection)
  const noteDisabled = !isEnabled || !selectedAnnotation || !onNotePress
  const tagsDisabled = !isEnabled || !selectedAnnotation || !onTagsPress
  const relationsDisabled = !isEnabled || !selectedAnnotation || !onRelationsPress
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

  const getColor = (type: AnnotationType) =>
    selectedAnnotation?.type === type ? resolvedColor : theme.colors.grey

  const handleApply = (color: string, type: AnnotationType) => {
    if (selectedAnnotation) {
      onChangeAnnotationColor?.(color)
      onChangeAnnotationType?.(type)
    } else {
      onApplyAnnotation(color, type)
    }
  }

  return (
    <Sheet ref={ref} backdrop={false} onClose={onClose}>
      <SheetView className="pt-[14px]" testID="annotation-toolbar">
        <HStack className="px-[16px] pb-[14px] items-center gap-[8px]">
          <Box className="flex-1 min-w-0 gap-[4px]">
            <Text className="font-bold text-[18px]" numberOfLines={1}>
              {t('Mode libre')}
            </Text>
            <Text className="text-[14px] text-grey" numberOfLines={2}>
              {selectedAnnotation
                ? verseToReference([selectedAnnotation.verseKey])
                : selection
                  ? formatSelectionRange(selection)
                  : t('Sélectionnez du texte dans la Bible')}
            </Text>
          </Box>
          {(selectedAnnotation || hasSelection) && (
            <Box className="pl-[6px]">
              <TouchableBox
                className="w-[48px] h-[44px] gap-[3px] items-center justify-center rounded-[8px]"
                accessibilityRole="button"
                accessibilityLabel={t('Supprimer')}
                onPress={selectedAnnotation ? onDeleteAnnotation : onEraseAnnotations}
              >
                <FeatherIcon name="trash-2" size={20} color="quart" />
              </TouchableBox>
            </Box>
          )}
        </HStack>

        <AnimatedBox layout={LinearTransition} className="overflow-hidden border-continuous">
          <HStack className="overflow-hidden border-continuous mx-[16px] gap-[8px] items-center">
            <AnnotationTypeButton
              disabled={disabled}
              type="background"
              activeType={activeAnnotationType}
              onPress={setActiveAnnotationType}
              label={t('Surligner')}
            >
              <AnnotationPreview type="background" color={getColor('background')} />
            </AnnotationTypeButton>

            <AnnotationTypeButton
              disabled={disabled}
              type="underline"
              activeType={activeAnnotationType}
              onPress={setActiveAnnotationType}
              label={t('Souligner')}
            >
              <AnnotationPreview type="underline" color={getColor('underline')} />
            </AnnotationTypeButton>

            <AnnotationTypeButton
              disabled={disabled}
              type="circle"
              activeType={activeAnnotationType}
              onPress={setActiveAnnotationType}
              label={t('Entourer')}
            >
              <AnnotationPreview type="circle" color={getColor('circle')} />
            </AnnotationTypeButton>
          </HStack>
          <Box className="border-continuous overflow-hidden">
            <AnnotationColorPalette
              disabled={disabled}
              type={activeAnnotationType}
              selectedColor={
                selectedAnnotation?.type === activeAnnotationType
                  ? selectedAnnotation.color
                  : undefined
              }
              onSelectColor={handleApply}
            />
          </Box>
        </AnimatedBox>
        <HStack className="mx-[16px] border-t border-border py-[12px] items-center">
          <TouchableBox
            className="flex-1 min-w-0 h-[44px] flex-row gap-[6px] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('Note')}
            onPress={onNotePress}
            disabled={noteDisabled}
            accessibilityState={{ disabled: noteDisabled }}
            style={{ opacity: noteDisabled ? 0.35 : 1 }}
          >
            <FeatherIcon
              name={selectedAnnotation?.noteId ? 'file-text' : 'file-plus'}
              size={20}
              color={selectedAnnotation?.noteId ? 'primary' : 'grey'}
            />
            <Text className="text-[13px] text-default" numberOfLines={1}>
              {t('Note')}
            </Text>
          </TouchableBox>
          <Box className="w-px h-[24px] bg-border" />
          <TouchableBox
            className="flex-1 min-w-0 h-[44px] flex-row gap-[6px] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={`${t('Étiquettes')}, ${tagsCount}`}
            onPress={onTagsPress}
            disabled={tagsDisabled}
            accessibilityState={{ disabled: tagsDisabled }}
            style={{ opacity: tagsDisabled ? 0.35 : 1 }}
          >
            <FeatherIcon name="tag" size={20} color={tagsCount > 0 ? 'primary' : 'grey'} />
            <Text className="text-[13px] text-default" numberOfLines={1}>
              {t('Étiquettes')}
            </Text>
            {tagsCount > 0 && (
              <Box className="absolute right-0 top-0 bg-primary rounded-full min-w-[14px] h-[14px] px-[2px] items-center justify-center">
                <Text className="text-[8px] text-reverse font-bold">{tagsCount}</Text>
              </Box>
            )}
          </TouchableBox>
          <Box className="w-px h-[24px] bg-border" />
          <TouchableBox
            className="flex-1 min-w-0 h-[44px] flex-row gap-[6px] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={`${t('Relations')}, ${relationsCount}`}
            onPress={onRelationsPress}
            disabled={relationsDisabled}
            accessibilityState={{ disabled: relationsDisabled }}
            style={{ opacity: relationsDisabled ? 0.35 : 1 }}
          >
            <FeatherIcon
              name="git-merge"
              size={20}
              color={relationsCount > 0 ? 'primary' : 'grey'}
            />
            <Text className="text-[13px] text-default" numberOfLines={1}>
              {t('Relations')}
            </Text>
            {relationsCount > 0 && (
              <Box className="absolute right-0 top-0 bg-primary rounded-full min-w-[14px] h-[14px] px-[2px] items-center justify-center">
                <Text className="text-[8px] text-reverse font-bold">{relationsCount}</Text>
              </Box>
            )}
          </TouchableBox>
        </HStack>
      </SheetView>
    </Sheet>
  )
}

export default AnnotationToolbar

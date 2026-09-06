import { twMerge } from '~common/ui/classNames'
import { useTheme } from '~themes/ThemeProvider'
import { type SheetRef, Sheet, SheetView } from '~common/sheet'
import { TouchableOpacity, type ViewStyle } from 'react-native'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import BackgroundIcon from '~assets/images/BackgroundIcon'
import CircleSketchIcon from '~assets/images/CircleSketchIcon'
import Box, {
  AnimatedBox,
  BoxProps,
  FadingBox,
  FadingText,
  HStack,
  TouchableBox,
} from '~common/ui/Box'
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

interface IconButtonProps extends BoxProps {
  disabled?: boolean
  children: React.ReactNode
  isSelected?: boolean
  label?: string
}

const IconButton = ({ disabled, children, isSelected, label, ...props }: IconButtonProps) => {
  return (
    <Box
      style={[
        { borderWidth: isSelected ? 2 : 1, opacity: isSelected ? 1 : disabled ? 0.5 : 0.85 },
        props.style,
        {
          transitionProperty: ['backgroundColor', 'borderColor', 'opacity'],
          transitionDuration: 300,
        } as unknown as ViewStyle,
      ]}
      {...props}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          isSelected ? 'border-primary' : 'border-border',
          twMerge(
            'overflow-hidden border-continuous px-[20px] py-[10px] rounded-[18px] gap-[10px] items-center justify-center',
            props.className
          )
        )
      )}
    >
      {children}
      {label && (
        <Text
          className={twMerge(
            isSelected ? 'text-primary' : 'text-tertiary',
            'text-[12px] font-bold'
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Box>
  )
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
    className="overflow-hidden border-continuous"
    disabled={disabled}
    onPress={() => onPress(type)}
    style={[{ opacity: disabled ? 0.6 : 1 }, [{ opacity: disabled ? 0.6 : 1 }]]}
  >
    <IconButton disabled={disabled} isSelected={!disabled && activeType === type} label={label}>
      {children}
    </IconButton>
  </TouchableBox>
)

type AnnotationColorPaletteProps = {
  disabled: boolean
  type: AnnotationType
  selectedColor?: string
  onSelectColor: (colorKey: string, type: AnnotationType) => void
}

type AnnotationTargetLabelProps = {
  label: string
  reference: string
}

const AnnotationTargetLabel = ({ label, reference }: AnnotationTargetLabelProps) => (
  <HStack className="overflow-hidden border-continuous max-w-[220px] items-center justify-center">
    <FadingText
      className="overflow-hidden border-continuous text-[15px] text-grey"
      numberOfLines={1}
    >
      {`${label} `}
    </FadingText>
    <FadingText
      className="overflow-hidden border-continuous text-[15px] text-grey font-bold"
      numberOfLines={1}
    >
      {reference}
    </FadingText>
  </HStack>
)

const AnnotationColorPalette = ({
  disabled,
  type,
  selectedColor,
  onSelectColor,
}: AnnotationColorPaletteProps) => {
  const colorItems = useColorItems()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)

  return (
    <HStack className="overflow-hidden border-continuous items-center justify-center gap-[10px] pb-[16px] px-[20px]">
      {colorItems.map(color => (
        <TouchableBox
          className="border-continuous overflow-hidden rounded-[12px] items-center justify-center bg-reverse border-primary"
          key={color.key}
          onPress={() => onSelectColor(color.key, type)}
          style={{ borderWidth: selectedColor === color.key ? 2 : 0, width: 30, height: 30 }}
        >
          <Box
            className="overflow-hidden border-continuous rounded-[8px]"
            style={[
              {
                width: selectedColor === color.key ? 20 : 24,
                height: selectedColor === color.key ? 20 : 24,
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
        style={{ width: 30, height: 30 }}
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
  const disabled = !selectedAnnotation && !hasSelection
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

  const resolvedColor = useResolvedColor(selectedAnnotation?.color)

  const getColor = (type: AnnotationType) => {
    if (activeAnnotationType === type) {
      return selectedAnnotation?.type === type ? resolvedColor : theme.colors.tertiary
    }
    if (selectedAnnotation) {
      return selectedAnnotation.type === type ? resolvedColor : theme.colors.grey
    }
    return theme.colors.grey
  }

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
      <SheetView className="pt-[14px]">
        <Box className="overflow-hidden border-continuous px-[20px] min-h-[92px] justify-center relative">
          <Text className="font-bold text-[18px] text-center px-[76px]">{t('Mode libre')}</Text>

          {(selectedAnnotation || hasSelection) && (
            <AnimatedBox
              className="overflow-hidden border-continuous absolute right-[20px] top-[0px]"
              layout={LinearTransition}
            >
              <TouchableOpacity
                accessibilityLabel={t('Supprimer')}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                onPress={selectedAnnotation ? onDeleteAnnotation : onEraseAnnotations}
                disabled={disabled}
              >
                <Box className="border-continuous overflow-hidden w-[32px] h-[32px] rounded-[10px] items-center justify-center border-quart border-[1px]">
                  <FeatherIcon name="trash-2" size={17} color="quart" />
                </Box>
              </TouchableOpacity>
            </AnimatedBox>
          )}

          {selectedAnnotation && (
            <AnimatedBox
              className="border-continuous overflow-visible flex-row gap-[6px] absolute left-[20px] top-[0px]"
              layout={LinearTransition}
            >
              <TouchableOpacity
                accessibilityLabel={t('Note')}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                onPress={onNotePress}
                disabled={disabled}
              >
                <Box className="border-continuous overflow-hidden w-[32px] h-[32px] rounded-[10px] items-center justify-center border-border border-[1px]">
                  <FeatherIcon
                    name={selectedAnnotation.noteId ? 'file-text' : 'file-plus'}
                    size={17}
                    color={selectedAnnotation.noteId ? 'primary' : 'grey'}
                  />
                </Box>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel={`${t('Étiquettes')}, ${tagsCount}`}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                onPress={onTagsPress}
                disabled={disabled}
              >
                <Box className="border-continuous overflow-visible relative">
                  <Box className="border-continuous overflow-hidden w-[32px] h-[32px] rounded-[10px] items-center justify-center border-border border-[1px]">
                    <FeatherIcon name="tag" size={18} color={tagsCount > 0 ? 'primary' : 'grey'} />
                  </Box>
                  {tagsCount > 0 && (
                    <Box className="overflow-hidden border-continuous absolute bottom-[-1px] right-[-4px] bg-primary rounded-[8px] w-[14px] h-[14px] items-center justify-center">
                      <Text className="text-[8px] text-reverse font-bold">{tagsCount}</Text>
                    </Box>
                  )}
                </Box>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel={`${t('Relations')}, ${relationsCount}`}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                onPress={onRelationsPress}
                disabled={disabled}
              >
                <Box className="border-continuous overflow-visible relative">
                  <Box className="border-continuous overflow-hidden w-[32px] h-[32px] rounded-[10px] items-center justify-center border-border border-[1px]">
                    <FeatherIcon
                      name="git-merge"
                      size={18}
                      color={relationsCount > 0 ? 'primary' : 'grey'}
                    />
                  </Box>
                  {relationsCount > 0 && (
                    <Box className="overflow-hidden border-continuous absolute bottom-[-1px] right-[-4px] bg-primary rounded-[8px] w-[14px] h-[14px] items-center justify-center">
                      <Text className="text-[8px] text-reverse font-bold">{relationsCount}</Text>
                    </Box>
                  )}
                </Box>
              </TouchableOpacity>
            </AnimatedBox>
          )}

          <FadingBox
            className="overflow-hidden border-continuous"
            keyProp={
              selectedAnnotation ? 'selectedAnnotation' : hasSelection ? 'hasSelection' : 'empty'
            }
          >
            {selectedAnnotation ? (
              <AnimatedBox
                className="overflow-hidden border-continuous items-center justify-center mt-[6px]"
                layout={LinearTransition}
              >
                <AnimatedBox
                  layout={LinearTransition}
                  className="overflow-hidden border-continuous"
                >
                  <AnnotationTargetLabel
                    label={t('Appliquer à')}
                    reference={verseToReference([selectedAnnotation.verseKey])}
                  />
                </AnimatedBox>
              </AnimatedBox>
            ) : hasSelection && selection?.start && selection?.end ? (
              <AnimatedBox
                className="overflow-hidden border-continuous items-center justify-center mt-[8px]"
                layout={LinearTransition}
              >
                <AnimatedBox
                  layout={LinearTransition}
                  className="overflow-hidden border-continuous"
                >
                  <AnnotationTargetLabel
                    label={t('Appliquer à')}
                    reference={formatSelectionRange(selection)}
                  />
                </AnimatedBox>
              </AnimatedBox>
            ) : (
              <Box className="overflow-hidden border-continuous items-center justify-center mt-[8px]">
                <FadingText className="overflow-hidden border-continuous text-[13px] text-grey text-center">
                  {t('Sélectionnez du texte dans la Bible')}
                </FadingText>
              </Box>
            )}
          </FadingBox>
        </Box>

        <AnimatedBox layout={LinearTransition} className="overflow-hidden border-continuous">
          <HStack className="overflow-hidden border-continuous px-[20px] pb-[20px] gap-[10px] items-center justify-center">
            <AnnotationTypeButton
              disabled={disabled}
              type="background"
              activeType={activeAnnotationType}
              onPress={setActiveAnnotationType}
              label={t('Surligner')}
            >
              <BackgroundIcon width={30} height={30} color={getColor('background')} />
            </AnnotationTypeButton>

            <AnnotationTypeButton
              disabled={disabled}
              type="underline"
              activeType={activeAnnotationType}
              onPress={setActiveAnnotationType}
              label={t('Souligner')}
            >
              <FeatherIcon name="underline" size={28} color={getColor('underline')} />
            </AnnotationTypeButton>

            <AnnotationTypeButton
              disabled={disabled}
              type="circle"
              activeType={activeAnnotationType}
              onPress={setActiveAnnotationType}
              label={t('Entourer')}
            >
              <CircleSketchIcon width={28} height={28} color={getColor('circle')} />
            </AnnotationTypeButton>
          </HStack>
          <Box className="border-continuous overflow-hidden border-t-[1px] border-border pt-[12px]">
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
      </SheetView>
    </Sheet>
  )
}

export default AnnotationToolbar

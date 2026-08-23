import { useTheme } from '@emotion/react'
import { type SheetRef, Sheet, SheetView } from '~common/sheet'
import { TouchableOpacity, type ViewStyle } from 'react-native'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

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

const IconButton = ({ disabled, children, isSelected, label, ...props }: IconButtonProps) => (
  <Box
    px={20}
    py={10}
    borderRadius={18}
    center
    gap={10}
    borderColor={isSelected ? 'primary' : 'border'}
    borderWidth={isSelected ? 2 : 1}
    opacity={isSelected ? 1 : disabled ? 0.5 : 0.85}
    style={
      {
        transitionProperty: ['backgroundColor', 'borderColor', 'opacity'],
        transitionDuration: 300,
      } as unknown as ViewStyle
    }
    {...props}
  >
    {children}
    {label && (
      <Text fontSize={12} bold color={isSelected ? 'primary' : 'tertiary'} numberOfLines={1}>
        {label}
      </Text>
    )}
  </Box>
)

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
  <TouchableBox disabled={disabled} onPress={() => onPress(type)}>
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
  <HStack maxWidth={220} center>
    <FadingText fontSize={15} color="grey" numberOfLines={1}>
      {`${label} `}
    </FadingText>
    <FadingText fontSize={15} color="grey" numberOfLines={1} bold>
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
    <HStack center gap={10} pb={16} px={20}>
      {colorItems.map(color => (
        <TouchableBox
          key={color.key}
          size={30}
          borderRadius={12}
          center
          bg="reverse"
          borderWidth={selectedColor === color.key ? 2 : 0}
          borderColor="primary"
          onPress={() => onSelectColor(color.key, type)}
        >
          <Box
            size={selectedColor === color.key ? 20 : 24}
            borderRadius={8}
            style={{ backgroundColor: color.hex }}
          />
        </TouchableBox>
      ))}
      <TouchableBox
        size={30}
        borderRadius={15}
        center
        bg="opacity5"
        onPress={() => {
          setColorPickerModal({
            selectedColor,
            onSelectColor: colorKey => onSelectColor(colorKey, type),
          })
        }}
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
  const [activeAnnotationType, setActiveAnnotationType] = useState<AnnotationType>('background')

  const resolvedColor = useResolvedColor(selectedAnnotation?.color)

  useEffect(() => {
    setActiveAnnotationType(selectedAnnotation?.type ?? 'background')
  }, [selectedAnnotation?.id, selectedAnnotation?.type])

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
      <SheetView pt={14}>
        <Box px={20} minH={92} justifyContent="center" position="relative">
          <Text bold fontSize={18} textAlign="center" px={76}>
            {t('Mode libre')}
          </Text>

          {(selectedAnnotation || hasSelection) && (
            <AnimatedBox layout={LinearTransition} position="absolute" right={20} top={0}>
              <TouchableOpacity
                onPress={selectedAnnotation ? onDeleteAnnotation : onEraseAnnotations}
                disabled={disabled}
              >
                <Box
                  width={32}
                  height={32}
                  borderRadius={10}
                  center
                  borderColor="quart"
                  borderWidth={1}
                >
                  <FeatherIcon name="trash-2" size={17} color="quart" />
                </Box>
              </TouchableOpacity>
            </AnimatedBox>
          )}

          {selectedAnnotation && (
            <AnimatedBox
              layout={LinearTransition}
              row
              gap={6}
              position="absolute"
              left={20}
              top={0}
              overflow="visible"
            >
              <TouchableOpacity onPress={onNotePress} disabled={disabled}>
                <Box
                  width={32}
                  height={32}
                  borderRadius={10}
                  center
                  borderColor="border"
                  borderWidth={1}
                >
                  <FeatherIcon
                    name={selectedAnnotation.noteId ? 'file-text' : 'file-plus'}
                    size={17}
                    color={selectedAnnotation.noteId ? 'primary' : 'grey'}
                  />
                </Box>
              </TouchableOpacity>
              <TouchableOpacity onPress={onTagsPress} disabled={disabled}>
                <Box position="relative" overflow="visible">
                  <Box
                    width={32}
                    height={32}
                    borderRadius={10}
                    center
                    borderColor="border"
                    borderWidth={1}
                  >
                    <FeatherIcon name="tag" size={18} color={tagsCount > 0 ? 'primary' : 'grey'} />
                  </Box>
                  {tagsCount > 0 && (
                    <Box
                      position="absolute"
                      bottom={-1}
                      right={-4}
                      bg="primary"
                      borderRadius={8}
                      width={14}
                      height={14}
                      center
                    >
                      <Text fontSize={8} color="reverse" bold>
                        {tagsCount}
                      </Text>
                    </Box>
                  )}
                </Box>
              </TouchableOpacity>
              <TouchableOpacity onPress={onRelationsPress} disabled={disabled}>
                <Box position="relative" overflow="visible">
                  <Box
                    width={32}
                    height={32}
                    borderRadius={10}
                    center
                    borderColor="border"
                    borderWidth={1}
                  >
                    <FeatherIcon
                      name="git-merge"
                      size={18}
                      color={relationsCount > 0 ? 'primary' : 'grey'}
                    />
                  </Box>
                  {relationsCount > 0 && (
                    <Box
                      position="absolute"
                      bottom={-1}
                      right={-4}
                      bg="primary"
                      borderRadius={8}
                      width={14}
                      height={14}
                      center
                    >
                      <Text fontSize={8} color="reverse" bold>
                        {relationsCount}
                      </Text>
                    </Box>
                  )}
                </Box>
              </TouchableOpacity>
            </AnimatedBox>
          )}

          <FadingBox
            keyProp={
              selectedAnnotation ? 'selectedAnnotation' : hasSelection ? 'hasSelection' : 'empty'
            }
          >
            {selectedAnnotation ? (
              <AnimatedBox
                alignItems="center"
                justifyContent="center"
                layout={LinearTransition}
                mt={6}
              >
                <AnimatedBox layout={LinearTransition}>
                  <AnnotationTargetLabel
                    label={t('Appliquer à')}
                    reference={verseToReference([selectedAnnotation.verseKey])}
                  />
                </AnimatedBox>
              </AnimatedBox>
            ) : hasSelection && selection?.start && selection?.end ? (
              <AnimatedBox
                alignItems="center"
                justifyContent="center"
                layout={LinearTransition}
                mt={8}
              >
                <AnimatedBox layout={LinearTransition}>
                  <AnnotationTargetLabel
                    label={t('Appliquer à')}
                    reference={formatSelectionRange(selection)}
                  />
                </AnimatedBox>
              </AnimatedBox>
            ) : (
              <Box center mt={8}>
                <FadingText fontSize={13} color="grey" textAlign="center">
                  {t('Sélectionnez du texte dans la Bible')}
                </FadingText>
              </Box>
            )}
          </FadingBox>
        </Box>

        <AnimatedBox layout={LinearTransition}>
          <HStack px={20} pb={20} gap={10} center>
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
          <Box borderTopWidth={1} borderColor="border" pt={12}>
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

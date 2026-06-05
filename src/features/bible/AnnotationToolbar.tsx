import { useTheme } from '@emotion/react'
import { type SheetRef, Sheet, SheetHeader, SheetView } from '~common/sheet'
import { TouchableOpacity, type ViewStyle } from 'react-native'
import { useAtomValue, useSetAtom } from 'jotai/react'
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
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { BOTTOM_INSET } from '~helpers/constants'
import verseToReference from '~helpers/verseToReference'
import { colorPickerModalAtom, isFullScreenBibleAtom } from 'src/state/app'
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
  tagsCount?: number
  isEnabled: boolean
}

interface IconButtonProps extends BoxProps {
  disabled?: boolean
  children: React.ReactNode
  buttonPosition?: 'start' | 'center' | 'end'
  isSelected?: boolean
  label?: string
}

const IconButton = ({
  disabled,
  children,
  buttonPosition = 'center',
  isSelected,
  label,
  ...props
}: IconButtonProps) => (
  <Box
    width={98}
    height={32}
    borderRadius={12}
    center
    row
    gap={6}
    borderColor="opacity5"
    borderTopLeftRadius={buttonPosition === 'start' ? 8 : 0}
    borderTopRightRadius={buttonPosition === 'end' ? 8 : 0}
    borderBottomLeftRadius={buttonPosition === 'start' ? 8 : 0}
    borderBottomRightRadius={buttonPosition === 'end' ? 8 : 0}
    borderWidth={1}
    bg={isSelected ? 'lightPrimary' : disabled ? 'lightGrey' : 'transparent'}
    opacity={isSelected ? 1 : disabled ? 0.5 : 0.7}
    style={
      {
        transitionProperty: ['backgroundColor', 'opacity'],
        transitionDuration: 300,
      } as unknown as ViewStyle
    }
    {...props}
  >
    {children}
    {label && (
      <Text fontSize={12} bold color={isSelected ? 'default' : 'tertiary'} numberOfLines={1}>
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
  buttonPosition?: 'start' | 'center' | 'end'
  label: string
}

const AnnotationTypeButton = ({
  disabled,
  type,
  activeType,
  onPress,
  children,
  buttonPosition,
  label,
}: AnnotationTypeButtonProps) => (
  <TouchableBox disabled={disabled} onPress={() => onPress(type)}>
    <IconButton
      disabled={disabled}
      buttonPosition={buttonPosition}
      isSelected={!disabled && activeType === type}
      label={label}
    >
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

const AnnotationColorPalette = ({
  disabled,
  type,
  selectedColor,
  onSelectColor,
}: AnnotationColorPaletteProps) => {
  const colorItems = useColorItems()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)

  if (disabled) {
    return null
  }

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
  tagsCount = 0,
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
    <Sheet
      ref={ref}
      backdrop={false}
      onClose={onClose}
      header={<SheetHeader title={t('Mode libre')} centerTitle />}
    >
      <SheetView pt={20}>
        <FadingBox
          keyProp={
            selectedAnnotation ? 'selectedAnnotation' : hasSelection ? 'hasSelection' : 'empty'
          }
        >
          {selectedAnnotation ? (
            <AnimatedBox
              row
              alignItems="center"
              justifyContent="center"
              gap={10}
              layout={LinearTransition}
              overflow="visible"
            >
              <AnimatedBox layout={LinearTransition} bg="opacity5" borderRadius={8} py={8} px={10}>
                <FadingText fontSize={16} numberOfLines={1} maxWidth={200}>
                  {selectedAnnotation.text}
                </FadingText>
              </AnimatedBox>
              <AnimatedBox layout={LinearTransition} center>
                <TouchableOpacity onPress={onNotePress} disabled={disabled}>
                  <Box
                    width={32}
                    height={32}
                    borderRadius={8}
                    center
                    borderColor="opacity5"
                    borderWidth={1}
                  >
                    <FeatherIcon
                      name={selectedAnnotation?.noteId ? 'file-text' : 'file-plus'}
                      size={18}
                      color={selectedAnnotation?.noteId ? 'primary' : 'grey'}
                    />
                  </Box>
                </TouchableOpacity>
              </AnimatedBox>
              <AnimatedBox layout={LinearTransition} center overflow="visible">
                <TouchableOpacity
                  onPress={onTagsPress}
                  disabled={disabled}
                  style={{ overflow: 'visible' }}
                >
                  <Box position="relative" overflow="visible">
                    <Box
                      width={32}
                      height={32}
                      borderRadius={8}
                      center
                      borderColor="opacity5"
                      borderWidth={1}
                    >
                      <FeatherIcon
                        name="tag"
                        size={18}
                        color={tagsCount > 0 ? 'primary' : 'grey'}
                      />
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
              </AnimatedBox>
              <AnimatedBox layout={LinearTransition} center>
                <TouchableOpacity onPress={onDeleteAnnotation} disabled={disabled}>
                  <Box
                    width={32}
                    height={32}
                    borderRadius={8}
                    center
                    borderColor="opacity5"
                    borderWidth={1}
                  >
                    <FeatherIcon name="trash-2" size={18} color="quart" />
                  </Box>
                </TouchableOpacity>
              </AnimatedBox>
            </AnimatedBox>
          ) : hasSelection && selection?.start && selection?.end ? (
            <AnimatedBox
              row
              alignItems="center"
              justifyContent="center"
              gap={10}
              layout={LinearTransition}
            >
              <AnimatedBox layout={LinearTransition} bg="opacity5" borderRadius={8} py={8} px={10}>
                <FadingText fontSize={16} numberOfLines={1} maxWidth={200}>
                  {formatSelectionRange(selection)}
                </FadingText>
              </AnimatedBox>
              <AnimatedBox layout={LinearTransition} center>
                <TouchableOpacity onPress={onEraseAnnotations}>
                  <Box
                    width={32}
                    height={32}
                    borderRadius={8}
                    center
                    borderColor="opacity5"
                    borderWidth={1}
                  >
                    <FeatherIcon name="trash-2" size={18} color="quart" />
                  </Box>
                </TouchableOpacity>
              </AnimatedBox>
            </AnimatedBox>
          ) : (
            <Box px={20} center>
              <FadingText fontSize={13} color="grey" textAlign="center">
                {t('Sélectionnez du texte dans la Bible')}
              </FadingText>
            </Box>
          )}
        </FadingBox>

        <AnimatedBox layout={LinearTransition}>
          <HStack center pt={20} pb={12} px={18}>
            <HStack>
              <AnnotationTypeButton
                disabled={disabled}
                type="background"
                activeType={activeAnnotationType}
                onPress={setActiveAnnotationType}
                buttonPosition="start"
                label={t('Surligner')}
              >
                <BackgroundIcon width={24} height={24} color={getColor('background')} />
              </AnnotationTypeButton>

              <AnnotationTypeButton
                disabled={disabled}
                type="underline"
                activeType={activeAnnotationType}
                onPress={setActiveAnnotationType}
                label={t('Souligner')}
              >
                <FeatherIcon name="underline" size={20} color={getColor('underline')} />
              </AnnotationTypeButton>

              <AnnotationTypeButton
                disabled={disabled}
                type="circle"
                activeType={activeAnnotationType}
                onPress={setActiveAnnotationType}
                buttonPosition="end"
                label={t('Entourer')}
              >
                <CircleSketchIcon width={20} height={20} color={getColor('circle')} />
              </AnnotationTypeButton>
            </HStack>
          </HStack>
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
        </AnimatedBox>
      </SheetView>
    </Sheet>
  )
}

export default AnnotationToolbar

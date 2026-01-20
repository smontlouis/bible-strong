import { useTheme } from '@emotion/react'
import BottomSheet, { BottomSheetHandle, BottomSheetView } from '@gorhom/bottom-sheet'
import { TouchableOpacity } from 'react-native'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { withMenuContext } from 'react-native-popup-menu'

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
import { useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { BOTTOM_INSET } from '~helpers/constants'
import verseToReference from '~helpers/verseToReference'
import { isFullScreenBibleAtom } from 'src/state/app'
import type { AnnotationType, SelectionRange } from './hooks/useAnnotationMode'

import { PopOverMenu } from './components/PopOverMenu'
import { ColorPopover } from './components/ColorPopover'
import { LinearTransition } from 'react-native-reanimated'

interface SelectedAnnotation {
  id: string
  verseKey: string
  text: string
  color: string
  type: AnnotationType
}

const formatSelectionRange = (selection: SelectionRange): string => {
  const [book, chapter, verse1] = selection.start.verseKey.split('-').map(Number)
  const verse2 = Number(selection.end.verseKey.split('-')[2])

  // Normalize: ensure startVerse <= endVerse (handles right-to-left selection)
  const startVerse = Math.min(verse1, verse2)
  const endVerse = Math.max(verse1, verse2)

  const verses = Array.from(
    { length: endVerse - startVerse + 1 },
    (_, i) => `${book}-${chapter}-${startVerse + i}`
  )

  return verseToReference(verses)
}

type Props = {
  ref?: React.RefObject<BottomSheet | null>
  hasSelection: boolean
  selection?: SelectionRange | null
  onApplyAnnotation: (color: string, type: AnnotationType) => void
  onClearSelection: () => void
  onEraseAnnotations: () => void
  onClose: () => void
  ctx: any
  selectedAnnotation?: SelectedAnnotation | null
  onChangeAnnotationColor?: (color: string) => void
  onChangeAnnotationType?: (type: AnnotationType) => void
  onDeleteAnnotation?: () => void
  onClearAnnotationSelection?: () => void
  isEnabled: boolean
}

interface IconButtonProps extends BoxProps {
  disabled?: boolean
  children: React.ReactNode
  buttonPosition?: 'start' | 'center' | 'end'
  isSelected?: boolean
}

const IconButton = ({
  disabled,
  children,
  buttonPosition = 'center',
  isSelected,
  ...props
}: IconButtonProps) => (
  <Box
    width={42}
    height={42}
    borderRadius={16}
    center
    borderColor="opacity5"
    borderTopLeftRadius={buttonPosition === 'start' ? 8 : 0}
    borderTopRightRadius={buttonPosition === 'end' ? 8 : 0}
    borderBottomLeftRadius={buttonPosition === 'start' ? 8 : 0}
    borderBottomRightRadius={buttonPosition === 'end' ? 8 : 0}
    borderWidth={1}
    bg={disabled ? 'lightGrey' : isSelected ? 'lightPrimary' : 'transparent'}
    opacity={disabled ? 0.5 : 1}
    style={{
      // @ts-ignore
      transitionProperty: ['backgroundColor', 'opacity'],
      transitionDuration: 300,
    }}
    {...props}
  >
    {children}
  </Box>
)

const AnnotationToolbar = ({
  ref,
  hasSelection,
  selection,
  onApplyAnnotation,
  onClearSelection,
  onEraseAnnotations,
  onClose,
  ctx,
  selectedAnnotation,
  onChangeAnnotationColor,
  onChangeAnnotationType,
  onDeleteAnnotation,
  onClearAnnotationSelection,
  isEnabled,
}: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  const { bottomBarHeight } = useBottomBarHeightInTab()

  const disabled = !selectedAnnotation && !hasSelection
  // const isActive = selectedAnnotation || hasSelection

  const getColor = (type: AnnotationType) => {
    if (selectedAnnotation) {
      return selectedAnnotation.type === type ? selectedAnnotation.color : theme.colors.grey
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

  const renderHandle = (handleProps: React.ComponentProps<typeof BottomSheetHandle>) => (
    <>
      <BottomSheetHandle {...handleProps} />
      <Box
        position="absolute"
        top={isEnabled ? -70 : 0}
        left={0}
        right={0}
        bottom={0}
        zIndex={1000}
        alignItems="center"
        justifyContent="center"
        style={{
          // @ts-ignore
          transitionProperty: ['top'],
          transitionDuration: 300,
        }}
      >
        <TouchableBox
          bg="primary"
          borderRadius={8}
          py={8}
          px={10}
          row
          gap={10}
          alignItems="center"
          onPress={onClose}
        >
          <Text fontSize={14} bold color="reverse">
            {t('Mode annotation')}
          </Text>
          <Box bg="reverse" borderRadius={20} size={16} center lightShadow opacity={0.5}>
            <FeatherIcon name="x" size={12} color="primary" />
          </Box>
        </TouchableBox>
      </Box>
    </>
  )

  return (
    <BottomSheet
      ref={ref}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      key={key}
      index={-1}
      {...bottomSheetStyles}
      backgroundStyle={{ backgroundColor: theme.colors.reverse }}
      handleComponent={renderHandle}
    >
      <BottomSheetView
        style={{
          flex: 0,
          paddingBottom: isFullScreenBible ? BOTTOM_INSET : bottomBarHeight,
        }}
      >
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
            >
              <AnimatedBox layout={LinearTransition} bg="opacity5" borderRadius={8} py={8} px={10}>
                <FadingText fontSize={16} numberOfLines={1} maxWidth={200}>
                  {selectedAnnotation.text}
                </FadingText>
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
          ) : hasSelection && selection ? (
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
          <HStack center py={20} px={20} gap={30}>
            <HStack>
              <PopOverMenu
                disabled={disabled}
                element={
                  <IconButton
                    disabled={disabled}
                    buttonPosition="start"
                    isSelected={selectedAnnotation?.type === 'background'}
                  >
                    <BackgroundIcon width={32} height={32} color={getColor('background')} />
                  </IconButton>
                }
                popover={
                  <ColorPopover
                    type="background"
                    onApply={handleApply}
                    ctx={ctx}
                    currentColor={
                      selectedAnnotation?.type === 'background'
                        ? selectedAnnotation.color
                        : undefined
                    }
                  />
                }
              />

              <PopOverMenu
                disabled={disabled}
                element={
                  <IconButton
                    disabled={disabled}
                    isSelected={selectedAnnotation?.type === 'underline'}
                  >
                    <FeatherIcon name="underline" size={24} color={getColor('underline')} />
                  </IconButton>
                }
                popover={
                  <ColorPopover
                    type="underline"
                    onApply={handleApply}
                    ctx={ctx}
                    currentColor={
                      selectedAnnotation?.type === 'underline'
                        ? selectedAnnotation.color
                        : undefined
                    }
                  />
                }
              />

              <PopOverMenu
                disabled={disabled}
                element={
                  <IconButton
                    disabled={disabled}
                    buttonPosition="end"
                    isSelected={selectedAnnotation?.type === 'circle'}
                  >
                    <CircleSketchIcon width={24} height={24} color={getColor('circle')} />
                  </IconButton>
                }
                popover={
                  <ColorPopover
                    type="circle"
                    onApply={handleApply}
                    ctx={ctx}
                    currentColor={
                      selectedAnnotation?.type === 'circle' ? selectedAnnotation.color : undefined
                    }
                  />
                }
              />
            </HStack>

            {/* <TouchableOpacity
              onPress={selectedAnnotation ? onClearAnnotationSelection : onClearSelection}
              disabled={disabled}
            >
              <IconButton disabled={disabled} borderRadius={8}>
                <FeatherIcon name="x" size={20} color="grey" />
              </IconButton>
            </TouchableOpacity> */}
          </HStack>
        </AnimatedBox>
      </BottomSheetView>
    </BottomSheet>
  )
}

export default withMenuContext(AnnotationToolbar)

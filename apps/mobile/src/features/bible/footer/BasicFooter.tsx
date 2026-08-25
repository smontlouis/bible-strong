import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isBibleOverlayOpenAtom, isFullScreenBibleAtom } from 'src/state/app'
import { AnimatedHStack, AnimatedTouchableBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import AudioButton from './AudioButton'

export interface BasicFooterProps {
  onPlay: () => void
  isPlaying: boolean
  isDisabled?: boolean
  isLoading?: boolean
  hasError: boolean
  onPrevChapter?: () => void
  onNextChapter?: () => void
  type?: 'url' | 'tts'
}

const BasicFooter = ({
  onPlay,
  isPlaying,
  isDisabled,
  isLoading,
  hasError,
  onPrevChapter,
  onNextChapter,
  type,
}: BasicFooterProps) => {
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const insets = useSafeAreaInsets()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  const isBibleOverlayOpen = useAtomValue(isBibleOverlayOpenAtom)

  const fullScreenTranslateY = isFullScreenBible ? HEADER_HEIGHT + insets.bottom + 60 : 0
  const centerTranslateY = isFullScreenBible ? HEADER_HEIGHT : 0

  if (isBibleOverlayOpen) return null

  return (
    <>
      <AnimatedTouchableBox
        disabled={isDisabled || !onPrevChapter}
        width={40}
        height={40}
        overflow="visible"
        onPress={onPrevChapter}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.previousChapter')}
        accessibilityState={{ disabled: isDisabled || !onPrevChapter }}
        borderWidth={2}
        borderRadius={20}
        borderColor="lightGrey"
        bg="reverse"
        center
        position="absolute"
        bottom={10 + bottomBarHeight}
        left={10}
        style={{
          transform: [{ translateY: fullScreenTranslateY }],
          transitionProperty: 'transform',
          transitionDuration: 300,
        }}
      >
        <FeatherIcon name="arrow-left" size={20} color="tertiary" />
      </AnimatedTouchableBox>
      <PlayableButtons
        onPlay={onPlay}
        isPlaying={isPlaying}
        isDisabled={isDisabled}
        isLoading={isLoading}
        hasError={hasError}
        type={type}
        centerTranslateY={centerTranslateY}
      />
      <AnimatedTouchableBox
        disabled={isDisabled || !onNextChapter}
        width={40}
        height={40}
        center
        overflow="visible"
        onPress={onNextChapter}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.nextChapter')}
        accessibilityState={{ disabled: isDisabled || !onNextChapter }}
        borderWidth={2}
        borderRadius={20}
        borderColor="lightGrey"
        bg="reverse"
        position="absolute"
        bottom={10 + bottomBarHeight}
        right={10}
        style={{
          transform: [{ translateY: fullScreenTranslateY }],
          transitionProperty: 'transform',
          transitionDuration: 300,
        }}
      >
        <FeatherIcon name="arrow-right" size={20} color="tertiary" />
      </AnimatedTouchableBox>
    </>
  )
}

type PlayableButtonsProps = Pick<
  BasicFooterProps,
  'onPlay' | 'isPlaying' | 'isDisabled' | 'isLoading' | 'hasError' | 'type'
> & {
  centerTranslateY: number
}

const PlayableButtons = ({
  onPlay,
  isPlaying,
  isDisabled,
  isLoading,
  hasError,
  type,
  centerTranslateY,
}: PlayableButtonsProps) => {
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const accessibilityLabel = hasError
    ? t('accessibility.audioUnavailable')
    : isLoading
      ? t('accessibility.audioLoading')
      : isPlaying
        ? t('accessibility.pauseAudio')
        : t('accessibility.playAudio')

  return (
    <AnimatedHStack
      position="absolute"
      alignSelf="center"
      bottom={10 + bottomBarHeight}
      row
      bg="lightGrey"
      padding={2}
      borderRadius={50}
      overflow="visible"
      style={{
        transform: [{ translateY: centerTranslateY }],
        transitionProperty: 'transform',
        transitionDuration: 300,
      }}
    >
      <TouchableBox
        center
        width={50}
        height={50}
        disabled={isDisabled}
        activeOpacity={0.5}
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled, busy: isLoading }}
        bg={isPlaying ? 'primary' : 'reverse'}
        borderWidth={2}
        borderRadius={25}
        borderColor="lightGrey"
        position="relative"
        overflow="visible"
      >
        <AudioButton isPlaying={isPlaying} isLoading={isLoading} error={hasError} type={type} />
      </TouchableBox>
    </AnimatedHStack>
  )
}

export default BasicFooter

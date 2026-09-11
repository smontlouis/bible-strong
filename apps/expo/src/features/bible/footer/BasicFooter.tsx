import { Platform } from 'react-native'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isBibleOverlayOpenAtom, isFullScreenBibleAtom } from 'src/state/app'
import Box, { AnimatedHStack, AnimatedTouchableBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import AudioButton from './AudioButton'
export interface BasicFooterProps {
  isParallel?: boolean
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
  isParallel = false,
  onPlay,
  isPlaying,
  isDisabled,
  isLoading,
  hasError,
  onPrevChapter,
  onNextChapter,
  type,
}: BasicFooterProps) => {
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const isWide = useResponsiveWorkspace()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  const isBibleOverlayOpen = useAtomValue(isBibleOverlayOpenAtom)

  const fullScreenTranslateY = isFullScreenBible ? HEADER_HEIGHT + insets.bottom + 60 : 0
  const centerTranslateY = isFullScreenBible ? HEADER_HEIGHT : 0

  if (isBibleOverlayOpen) return null

  return (
    <Box
      pointerEvents="box-none"
      className="absolute top-0 w-full h-full self-center"
      style={{ maxWidth: isWide && !isParallel ? 710 : undefined }}
    >
      <AnimatedTouchableBox
        className="border-continuous overflow-visible w-[40px] h-[40px] border-[2px] rounded-[20px] border-light-grey bg-reverse items-center justify-center absolute left-[10px]"
        disabled={isDisabled || !onPrevChapter}
        onPress={onPrevChapter}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.previousChapter')}
        accessibilityState={{ disabled: isDisabled || !onPrevChapter }}
        style={[
          { opacity: isDisabled || !onPrevChapter ? 0.6 : 1 },
          [
            {
              bottom: Platform.OS === 'web' ? '50%' : isWide ? '25%' : 10 + bottomBarHeight,
              opacity: isDisabled || !onPrevChapter ? 0.6 : 1,
            },
            {
              transform: [{ translateY: fullScreenTranslateY }],
              transitionProperty: 'transform',
              transitionDuration: 300,
            },
          ],
        ]}
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
        className="border-continuous overflow-visible w-[40px] h-[40px] items-center justify-center border-[2px] rounded-[20px] border-light-grey bg-reverse absolute right-[10px]"
        disabled={isDisabled || !onNextChapter}
        onPress={onNextChapter}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.nextChapter')}
        accessibilityState={{ disabled: isDisabled || !onNextChapter }}
        style={[
          { opacity: isDisabled || !onNextChapter ? 0.6 : 1 },
          [
            {
              bottom: Platform.OS === 'web' ? '50%' : isWide ? '25%' : 10 + bottomBarHeight,
              opacity: isDisabled || !onNextChapter ? 0.6 : 1,
            },
            {
              transform: [{ translateY: fullScreenTranslateY }],
              transitionProperty: 'transform',
              transitionDuration: 300,
            },
          ],
        ]}
      >
        <FeatherIcon name="arrow-right" size={20} color="tertiary" />
      </AnimatedTouchableBox>
    </Box>
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
  const stylingTheme = useStylingTheme()

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
      className="border-continuous overflow-visible absolute self-center flex-row bg-light-grey p-[2px] rounded-[50px]"
      style={[
        { bottom: 10 + bottomBarHeight },
        {
          transform: [{ translateY: centerTranslateY }],
          transitionProperty: 'transform',
          transitionDuration: 300,
        },
      ]}
    >
      <TouchableBox
        className="border-continuous overflow-visible items-center justify-center w-[50px] h-[50px] border-[2px] rounded-[25px] border-light-grey relative"
        disabled={isDisabled}
        activeOpacity={0.5}
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled, busy: isLoading }}
        style={[
          { opacity: isDisabled ? 0.6 : 1 },
          [
            {
              backgroundColor: resolveThemeColor(stylingTheme, isPlaying ? 'primary' : 'reverse'),
              opacity: isDisabled ? 0.6 : 1,
            },
          ],
        ]}
      >
        <AudioButton isPlaying={isPlaying} isLoading={isLoading} error={hasError} type={type} />
      </TouchableBox>
    </AnimatedHStack>
  )
}

export default BasicFooter

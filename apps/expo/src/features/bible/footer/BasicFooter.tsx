import { Platform } from 'react-native'
import { LayoutAnimationConfig } from 'react-native-reanimated'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'
import { floatingShadow } from '~common/ui/surfaces'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { isFooterAudioEnabled } from '~redux/modules/user'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isBibleOverlayOpenAtom } from 'src/state/app'
import { useFooterFullScreen } from './footerFullScreen'
import {
  CHAPTER_NAV_ICON_SIZE,
  chapterNavButtonStyle,
  chapterNavSideOffset,
} from './chapterNavButton'
import Box, { AnimatedBox, AnimatedHStack, AnimatedTouchableBox } from '~common/ui/Box'
import { colorTransition, popIn } from '~common/ui/motion'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import AudioButton from './AudioButton'
import MusicButton, { MUSIC_BUTTON_SIZE } from '~features/bible-audio/ui/MusicButton'
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
  const { bottomBarHeight, miniPlayerHeight } = useBottomBarHeightInTab()
  const isWide = useResponsiveWorkspace()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isFullScreenBible = useFooterFullScreen()
  const isBibleOverlayOpen = useAtomValue(isBibleOverlayOpenAtom)
  // The reader can hide the play and music block in the Bible settings; the chapter arrows stay.
  const showAudio = useSelector((state: RootState) =>
    isFooterAudioEnabled(state.user.bible.settings.footerAudio)
  )

  // In full screen the tab bar, with the small audio player in it, slides away: the chapter
  // buttons leave the screen and the play button comes down where the bar was.
  const fullScreenTranslateY = isFullScreenBible
    ? HEADER_HEIGHT + miniPlayerHeight + insets.bottom + 60
    : 0
  const centerTranslateY = isFullScreenBible ? HEADER_HEIGHT + miniPlayerHeight : 0

  if (isBibleOverlayOpen) return null

  return (
    <Box
      pointerEvents="box-none"
      className="absolute top-0 w-full h-full self-center"
      style={{ maxWidth: isWide && !isParallel && Platform.OS !== 'web' ? 710 : undefined }}
    >
      <AnimatedTouchableBox
        className="border-continuous overflow-visible bg-surface-raised items-center justify-center absolute"
        disabled={isDisabled || !onPrevChapter}
        onPress={onPrevChapter}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.previousChapter')}
        accessibilityState={{ disabled: isDisabled || !onPrevChapter }}
        style={[
          chapterNavButtonStyle,
          {
            left: chapterNavSideOffset(isParallel),
            opacity: isDisabled || !onPrevChapter ? 0.6 : 1,
          },
          [
            {
              bottom: Platform.OS === 'web' ? '50%' : isWide ? '25%' : 10 + bottomBarHeight,
              opacity: isDisabled || !onPrevChapter ? 0.6 : 1,
            },
            {
              transform: [{ translateY: fullScreenTranslateY }],
              transitionProperty: ['transform', 'bottom'],
              transitionDuration: 300,
            },
          ],
        ]}
      >
        <FeatherIcon name="chevron-left" size={CHAPTER_NAV_ICON_SIZE} color="tertiary" />
      </AnimatedTouchableBox>
      {showAudio && (
        <PlayableButtons
          onPlay={onPlay}
          isPlaying={isPlaying}
          isDisabled={isDisabled}
          isLoading={isLoading}
          hasError={hasError}
          type={type}
          centerTranslateY={centerTranslateY}
        />
      )}
      <AnimatedTouchableBox
        className="border-continuous overflow-visible items-center justify-center bg-surface-raised absolute"
        disabled={isDisabled || !onNextChapter}
        onPress={onNextChapter}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.nextChapter')}
        accessibilityState={{ disabled: isDisabled || !onNextChapter }}
        style={[
          chapterNavButtonStyle,
          {
            right: chapterNavSideOffset(isParallel),
            opacity: isDisabled || !onNextChapter ? 0.6 : 1,
          },
          [
            {
              bottom: Platform.OS === 'web' ? '50%' : isWide ? '25%' : 10 + bottomBarHeight,
              opacity: isDisabled || !onNextChapter ? 0.6 : 1,
            },
            {
              transform: [{ translateY: fullScreenTranslateY }],
              transitionProperty: ['transform', 'bottom'],
              transitionDuration: 300,
            },
          ],
        ]}
      >
        <FeatherIcon name="chevron-right" size={CHAPTER_NAV_ICON_SIZE} color="tertiary" />
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
        ? t('bibleAudio.open')
        : t('accessibility.playAudio')

  return (
    // One block floats over the text: the Bible audio and the music, each in its own circle.
    <AnimatedHStack
      className="border-continuous overflow-visible absolute self-center flex-row items-center rounded-full p-[5px] gap-[6px]"
      style={[
        {
          bottom: 10 + bottomBarHeight,
          backgroundColor: resolveThemeColor(stylingTheme, 'surfaceRaised'),
          ...floatingShadow,
        },
        {
          transform: [{ translateY: centerTranslateY }],
          transitionProperty: ['transform', 'bottom'],
          transitionDuration: 300,
        },
      ]}
    >
      <AnimatedTouchableBox
        className="border-continuous overflow-visible items-center justify-center rounded-full relative"
        disabled={isDisabled}
        activeOpacity={0.5}
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled, busy: isLoading }}
        style={{
          ...colorTransition,
          width: MUSIC_BUTTON_SIZE,
          height: MUSIC_BUTTON_SIZE,
          opacity: isDisabled ? 0.6 : 1,
          backgroundColor: isPlaying
            ? resolveThemeColor(stylingTheme, 'primary')
            : (colorWithOpacity(stylingTheme.colors.default, 0.06) ?? 'transparent'),
        }}
      >
        {/* The speaker turns white on blue with a small pop when the passage plays. */}
        <LayoutAnimationConfig skipEntering>
          <AnimatedBox
            key={hasError ? 'error' : isPlaying && isLoading ? 'loading' : isPlaying ? 'on' : 'off'}
            entering={popIn}
          >
            <AudioButton isPlaying={isPlaying} isLoading={isLoading} error={hasError} type={type} />
          </AnimatedBox>
        </LayoutAnimationConfig>
      </AnimatedTouchableBox>
      <MusicButton />
    </AnimatedHStack>
  )
}

export default BasicFooter

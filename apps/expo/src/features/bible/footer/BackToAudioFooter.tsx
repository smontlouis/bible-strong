import { Platform } from 'react-native'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isBibleOverlayOpenAtom, isFullScreenBibleAtom } from 'src/state/app'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { AnimatedHStack, AnimatedTouchableBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import { useFindTabIndex, type VersionCode } from '../../../state/tabs'
import { playingBibleTabIdAtom } from './atom'
import {
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
  resolveBibleCoverageCanonId,
} from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
type BackToAudioFooterProps = {
  isParallel?: boolean
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  disabled?: boolean
  coverage?: BibleVersionCoverage
  version: VersionCode
}

const BackToAudioFooter = ({
  isParallel = false,
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  coverage,
  version,
}: BackToAudioFooterProps) => {
  const canonId = resolveBibleCoverageCanonId(coverage, getBibleVersionCanonId(version))
  const hasPreviousChapter = !!getPreviousAvailableChapterLocation(book, chapter, coverage, canonId)
  const hasNextChapter = !!getNextAvailableChapterLocation(book, chapter, coverage, canonId)
  const { slideToIndex } = useTabAnimations()
  const playingBibleTabId = useAtomValue(playingBibleTabIdAtom)
  const playingBibleTabIndex = useFindTabIndex(playingBibleTabId)
  const isWide = useResponsiveWorkspace()
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()
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
        disabled={disabled || !hasPreviousChapter}
        onPress={hasPreviousChapter ? goToPrevChapter : undefined}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.previousChapter')}
        accessibilityState={{ disabled: disabled || !hasPreviousChapter }}
        style={[
          { opacity: disabled || !hasPreviousChapter ? 0.6 : 1 },
          [
            {
              bottom: Platform.OS === 'web' ? '50%' : isWide ? '25%' : 10 + bottomBarHeight,
              opacity: disabled || !hasPreviousChapter ? 0.6 : 1,
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
          className="border-continuous overflow-visible items-center justify-center px-[15px] py-[10px] bg-primary rounded-[12px] border-light-grey relative flex-row"
          onPress={() => slideToIndex(playingBibleTabIndex)}
          accessibilityRole="button"
          accessibilityLabel={t('audio.goBack')}
        >
          <Text className="text-reverse">{t('audio.goBack')}</Text>
          <FeatherIcon name="volume-2" style={{ marginLeft: 10 }} size={20} color="reverse" />
        </TouchableBox>
      </AnimatedHStack>
      <AnimatedTouchableBox
        className="border-continuous overflow-visible w-[40px] h-[40px] items-center justify-center border-[2px] rounded-[20px] border-light-grey bg-reverse absolute right-[10px]"
        disabled={disabled || !hasNextChapter}
        onPress={hasNextChapter ? goToNextChapter : undefined}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.nextChapter')}
        accessibilityState={{ disabled: disabled || !hasNextChapter }}
        style={[
          { opacity: disabled || !hasNextChapter ? 0.6 : 1 },
          [
            {
              bottom: Platform.OS === 'web' ? '50%' : isWide ? '25%' : 10 + bottomBarHeight,
              opacity: disabled || !hasNextChapter ? 0.6 : 1,
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

export default BackToAudioFooter

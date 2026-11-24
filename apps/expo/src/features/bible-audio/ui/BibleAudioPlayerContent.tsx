import { useAtomValue } from 'jotai/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import type { Book } from '~assets/bible_versions/books-desc'
import { getDefaultBibleTab, type BibleTab, type BibleTabActions } from '~state/tabs'
import { bibleAudioStateAtom } from '../atoms'
import {
  changePassage,
  closeBibleAudioPlayer,
  getAdjacentPassage,
  goToAdjacentChapter,
  loadBibleAudioCoverage,
  setSource,
  skip,
  togglePlay,
} from '../bibleAudioPlayer'
import { hasRecordedAudio } from '../recordedEngine'
import type { BibleAudioPassage, BibleAudioSource } from '../types'
import { useShowBibleAudioText } from '../useShowBibleAudioText'
import AudioRepeatButton from './AudioRepeatButton'
import AudioSleepButton from './AudioSleepButton'
import AudioSpeedButton from './AudioSpeedButton'
import BibleAudioProgressBar from './BibleAudioProgressBar'
import ChapterButton from './ChapterButton'
import PlayButton from './PlayButton'
import TTSPitchButton from './TTSPitchButton'
import TTSRepeatButton from './TTSRepeatButton'
import TTSSpeedButton from './TTSSpeedButton'
import TTSVoiceButton from './TTSVoiceButton'
import { useBibleAudioLabels } from './useBibleAudioLabels'

type PillProps = {
  label: string
  isActive?: boolean
  onPress: () => void
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'radio' | 'link'
}

// A pill filled with a tint, the primary one when chosen: no outline.
const Pill = ({ label, isActive, onPress, accessibilityLabel, accessibilityRole }: PillProps) => {
  const theme = useTheme()
  return (
    <TouchableBox
      className="overflow-hidden border-continuous flex-row items-center px-[12px] h-[30px] rounded-full"
      style={{
        backgroundColor: isActive
          ? colorWithOpacity(theme.colors.primary, 0.12)
          : colorWithOpacity(theme.colors.default, 0.07),
      }}
      onPress={onPress}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityRole === 'radio' ? { checked: !!isActive } : undefined}
    >
      <Text
        className={twMerge(isActive ? 'text-link' : 'text-default', 'text-[12px] font-bold')}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableBox>
  )
}

/** The Bible tab data the book and version selectors read, made from the player's passage. */
const getSelectorData = (passage: BibleAudioPassage): BibleTab['data'] => ({
  ...getDefaultBibleTab(passage.version).data,
  selectedBook: passage.book,
  selectedChapter: passage.chapter,
  temp: { selectedBook: passage.book, selectedChapter: passage.chapter, selectedVerse: 1 },
})

const useAdjacentChapters = (passage: BibleAudioPassage | null) => {
  const [adjacent, setAdjacent] = useState({ previous: false, next: false })
  useEffect(() => {
    if (!passage) return
    let cancelled = false
    void Promise.all([
      getAdjacentPassage(passage, 'previous'),
      getAdjacentPassage(passage, 'next'),
    ]).then(([previous, next]) => {
      if (!cancelled) setAdjacent({ previous: !!previous, next: !!next })
    })
    return () => {
      cancelled = true
    }
  }, [passage])
  return adjacent
}

/** The controls of the large player, the same in the sheet and in the panel of a wide screen. */
const BibleAudioPlayerContent = () => {
  const { t } = useTranslation()
  const { passage, source, status } = useAtomValue(bibleAudioStateAtom)
  const { title, subtitle } = useBibleAudioLabels()
  const { openBookSelector, openVersionSelector } = useBookAndVersionSelector()
  const showText = useShowBibleAudioText()
  const adjacent = useAdjacentChapters(passage)

  if (!passage) return null

  const isPlaying = status === 'playing'
  const isLoading = status === 'loading'
  const canSwitchSource = hasRecordedAudio(passage.version)

  const chooseVersion = () =>
    openVersionSelector({
      actions: {
        setSelectedVersion: version => changePassage({ ...passage, version }),
        setParallelVersion: () => {},
      },
      data: getSelectorData(passage),
    })

  const chooseChapter = async () => {
    let temp: { book: Book; chapter: number } = { book: passage.book, chapter: passage.chapter }
    // The selector moves a tab through these four; the player only needs the book and chapter.
    const actions = {
      setTempSelectedBook: (book: Book) => {
        temp = { ...temp, book }
      },
      setTempSelectedChapter: (chapter: number) => {
        temp = { ...temp, chapter }
      },
      setTempSelectedVerse: () => {},
      validateTempSelected: () => changePassage({ ...passage, ...temp }),
    } as Partial<BibleTabActions> as BibleTabActions
    const coverage = await loadBibleAudioCoverage(passage.version)
    openBookSelector({ actions, data: getSelectorData(passage), coverage })
  }

  const chooseSource = (next: BibleAudioSource) => setSource(next)

  return (
    <Box>
      <HStack className="items-center gap-[6px]">
        {canSwitchSource && (
          <>
            <Pill
              label={t('bibleAudio.recorded')}
              isActive={source === 'recorded'}
              onPress={() => chooseSource('recorded')}
              accessibilityRole="radio"
            />
            <Pill
              label={t('bibleAudio.speech')}
              isActive={source === 'speech'}
              onPress={() => chooseSource('speech')}
              accessibilityRole="radio"
            />
          </>
        )}
        <Box className="flex-[1]" />
        <Pill
          label="Audibible"
          onPress={() => Linking.openURL('https://click.audibible.app/5nmN/stephane30')}
          accessibilityRole="link"
          accessibilityLabel={t('accessibility.openAudibible')}
        />
        <TouchableBox
          className="w-[36px] h-[36px] items-center justify-center"
          onPress={closeBibleAudioPlayer}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.reduceAudioPlayer')}
        >
          <FeatherIcon name="chevron-down" size={22} color="grey" />
        </TouchableBox>
      </HStack>

      <Box className="items-center mt-[16px]">
        <TouchableBox
          onPress={chooseChapter}
          accessibilityRole="button"
          accessibilityLabel={t('bibleAudio.chooseChapter')}
          accessibilityHint={title}
          className="flex-row items-center"
        >
          <Text className="text-[24px] font-bold" numberOfLines={1}>
            {title}
          </Text>
          <FeatherIcon name="chevron-down" size={18} color="grey" style={{ marginLeft: 4 }} />
        </TouchableBox>
        <TouchableBox
          onPress={chooseVersion}
          accessibilityRole="button"
          accessibilityLabel={t('bibleAudio.chooseVersion')}
          accessibilityHint={subtitle}
          className="flex-row items-center mt-[4px]"
        >
          <Text className="text-[13px] text-grey" numberOfLines={1}>
            {subtitle}
          </Text>
          <FeatherIcon name="chevron-down" size={14} color="grey" style={{ marginLeft: 4 }} />
        </TouchableBox>
      </Box>

      <Box className="mt-[20px]">
        <BibleAudioProgressBar />
      </Box>

      {status === 'error' && (
        <Text className="text-[12px] text-grey text-center mt-[8px]">
          {t('bibleAudio.unavailable')}
        </Text>
      )}

      <HStack className="items-center justify-center mt-[12px]">
        <ChapterButton
          hasNextChapter={adjacent.previous}
          direction="left"
          onPress={() => void goToAdjacentChapter('previous')}
        />
        <HStack className="flex-[1] items-center justify-center">
          <TouchableBox
            className="w-[44px] h-[44px] items-center justify-center"
            onPress={() => skip(-1)}
            accessibilityRole="button"
            accessibilityLabel={t(
              source === 'speech' ? 'accessibility.previousVerse' : 'accessibility.rewindTenSeconds'
            )}
          >
            <FeatherIcon
              name={source === 'speech' ? 'chevron-left' : 'rotate-ccw'}
              size={22}
              color="tertiary"
            />
          </TouchableBox>
          <PlayButton isPlaying={isPlaying} isLoading={isLoading} onToggle={togglePlay} />
          <TouchableBox
            className="w-[44px] h-[44px] items-center justify-center"
            onPress={() => skip(1)}
            accessibilityRole="button"
            accessibilityLabel={t(
              source === 'speech' ? 'accessibility.nextVerse' : 'accessibility.forwardTenSeconds'
            )}
          >
            <FeatherIcon
              name={source === 'speech' ? 'chevron-right' : 'rotate-cw'}
              size={22}
              color="tertiary"
            />
          </TouchableBox>
        </HStack>
        <ChapterButton
          hasNextChapter={adjacent.next}
          direction="right"
          onPress={() => void goToAdjacentChapter('next')}
        />
      </HStack>

      <HStack className="mt-[16px] items-center justify-center flex-wrap gap-[6px]">
        {source === 'speech' ? (
          <>
            <TTSVoiceButton currentVersion={passage.version} />
            <TTSSpeedButton />
            <TTSPitchButton />
            <TTSRepeatButton />
          </>
        ) : (
          <>
            <AudioSpeedButton />
            <AudioRepeatButton />
          </>
        )}
        <AudioSleepButton />
      </HStack>

      <Box className="items-center mt-[16px]">
        <TouchableBox
          className="flex-row items-center h-[44px] px-[12px]"
          onPress={showText}
          accessibilityRole="button"
          accessibilityLabel={t('bibleAudio.showText')}
        >
          <FeatherIcon name="book-open" size={16} color="primary" />
          <Text className="text-link text-[14px] font-bold ml-[6px]">
            {t('bibleAudio.showText')}
          </Text>
        </TouchableBox>
      </Box>
    </Box>
  )
}

export default BibleAudioPlayerContent

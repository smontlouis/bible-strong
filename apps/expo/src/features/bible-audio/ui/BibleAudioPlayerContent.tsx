import { useAtomValue } from 'jotai/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Linking } from 'react-native'
import { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import DropdownMenu from '~common/DropdownMenu'
import Box, { AnimatedBox, HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { colorWithOpacity } from '~themes/colorValues'
import { getBiblePart, getBiblePartColors } from '~themes/bibleBookColors'
import { useTheme } from '~themes/ThemeProvider'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import type { Book } from '~assets/bible_versions/books-desc'
import { getDefaultBibleTab, type BibleTab, type BibleTabActions } from '~state/tabs'
import { bibleAudioStateAtom } from '../atoms'
import { getRecording } from '../audioCatalog'
import {
  changePassage,
  closeBibleAudioPlayer,
  getAdjacentPassage,
  goToAdjacentChapter,
  loadBibleAudioCoverage,
  skip,
  togglePlay,
} from '../bibleAudioPlayer'
import type { BibleAudioPassage } from '../types'
import { useShowBibleAudioText } from '../useShowBibleAudioText'
import AudioChoiceButton from './AudioChoiceButton'
import AudioRepeatButton from './AudioRepeatButton'
import AudioSleepButton from './AudioSleepButton'
import AudioSpeedButton from './AudioSpeedButton'
import BibleAudioCover from './BibleAudioCover'
import BibleAudioProgressBar from './BibleAudioProgressBar'
import TTSPitchButton from './TTSPitchButton'
import TTSRepeatButton from './TTSRepeatButton'
import TTSSpeedButton from './TTSSpeedButton'
import TTSVoiceButton from './TTSVoiceButton'
import RecordingAttribution from './RecordingAttribution'
import { useBibleAudioLabels } from './useBibleAudioLabels'

const AUDIBIBLE_URL = 'https://click.audibible.app/5nmN/stephane30'

/** The Bible tab data the book and version selectors read, made from the player's passage. */
const getSelectorData = (passage: BibleAudioPassage): BibleTab['data'] => ({
  ...getDefaultBibleTab(passage.version).data,
  selectedBook: passage.book,
  selectedChapter: passage.chapter,
  temp: { selectedBook: passage.book, selectedChapter: passage.chapter, selectedVerse: 1 },
})

const useAdjacentChapters = (passage: BibleAudioPassage | null) => {
  const [adjacent, setAdjacent] = useState({ previous: false, next: false })
  const { source, recordingId } = useAtomValue(bibleAudioStateAtom)
  // A partial recording keeps to its books: Proverbs 31 has John 1 after it.
  const recording = source === 'recorded' ? getRecording(recordingId) : undefined
  const partial = recording?.books ? recording : undefined
  useEffect(() => {
    if (!passage) return
    let cancelled = false
    void Promise.all([
      getAdjacentPassage(passage, 'previous', partial),
      getAdjacentPassage(passage, 'next', partial),
    ]).then(([previous, next]) => {
      if (!cancelled) setAdjacent({ previous: !!previous, next: !!next })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage, partial?.id])
  return adjacent
}

const usePassageSelectors = (passage: BibleAudioPassage) => {
  const { openBookSelector, openVersionSelector } = useBookAndVersionSelector()

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

  return { chooseChapter, chooseVersion }
}

/** « Lire »: back to the text heard, in the tab it came from or a new one. */
const ReadButton = ({ compact }: { compact?: boolean }) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const showText = useShowBibleAudioText()
  return (
    <TouchableBox
      className="overflow-hidden border-continuous flex-row items-center rounded-full px-[14px]"
      style={{
        height: compact ? 32 : 40,
        backgroundColor: colorWithOpacity(theme.colors.default, 0.07),
      }}
      onPress={showText}
      accessibilityRole="button"
      accessibilityLabel={t('bibleAudio.showText')}
    >
      <FeatherIcon name="book-open" size={16} color="default" />
      <Text className="text-[13px] font-semibold ml-[6px]">{t('bibleAudio.read')}</Text>
    </TouchableBox>
  )
}

/** The menu of what is not a control: for now, the way to Audibible. */
const MoreMenu = () => {
  const { t } = useTranslation()
  return (
    <DropdownMenu
      title={t('bibleAudio.more')}
      setValue={value => {
        if (value === 'audibible') void Linking.openURL(AUDIBIBLE_URL)
      }}
      choices={[{ value: 'audibible', label: t('accessibility.openAudibible') }]}
      customRender={
        <Box className="w-[44px] h-[44px] items-center justify-center">
          <FeatherIcon name="more-horizontal" size={22} color="default" />
        </Box>
      }
    />
  )
}

type PassageTitleProps = { passage: BibleAudioPassage; size: 'large' | 'medium' }

/** « Genèse 1 » and the version, each opening its selector. */
const PassageTitle = ({ passage, size }: PassageTitleProps) => {
  const { t } = useTranslation()
  const { title, subtitle, shortSubtitle } = useBibleAudioLabels()
  const { chooseChapter, chooseVersion } = usePassageSelectors(passage)
  return (
    <Box className="flex-[1] min-w-0">
      <TouchableBox
        onPress={chooseChapter}
        accessibilityRole="button"
        accessibilityLabel={t('bibleAudio.chooseChapter')}
        accessibilityHint={title}
        className="flex-row items-center self-start"
      >
        <Text
          className={size === 'large' ? 'text-[20px] font-bold' : 'text-[18px] font-bold'}
          numberOfLines={1}
        >
          {title}
        </Text>
        <FeatherIcon name="chevron-down" size={16} color="grey" style={{ marginLeft: 4 }} />
      </TouchableBox>
      <TouchableBox
        onPress={chooseVersion}
        accessibilityRole="button"
        accessibilityLabel={t('bibleAudio.chooseVersion')}
        accessibilityHint={subtitle}
        className="flex-row items-center self-start mt-[2px]"
      >
        <Text className="text-[16px] text-grey" numberOfLines={1}>
          {shortSubtitle}
        </Text>
        <FeatherIcon name="chevron-down" size={16} color="grey" style={{ marginLeft: 4 }} />
      </TouchableBox>
    </Box>
  )
}

type TransportProps = { passage: BibleAudioPassage; scale?: number }

/**
 * Audibible's transport: the chapter before and after on either side of play, a step of ten
 * seconds (or a verse of the device's voice) at each end.
 */
const Transport = ({ passage, scale = 1 }: TransportProps) => {
  const { t } = useTranslation()
  const { source, status } = useAtomValue(bibleAudioStateAtom)
  const adjacent = useAdjacentChapters(passage)
  const isPlaying = status === 'playing'
  const isLoading = status === 'loading'
  const isSpeech = source === 'speech'

  const step = (direction: -1 | 1) => (
    <TouchableBox
      className="w-[48px] h-[48px] items-center justify-center"
      onPress={() => skip(direction)}
      accessibilityRole="button"
      accessibilityLabel={t(
        isSpeech
          ? direction === -1
            ? 'accessibility.previousVerse'
            : 'accessibility.nextVerse'
          : direction === -1
            ? 'accessibility.rewindTenSeconds'
            : 'accessibility.forwardTenSeconds'
      )}
    >
      <FeatherIcon
        name={
          isSpeech
            ? direction === -1
              ? 'corner-up-left'
              : 'corner-up-right'
            : direction === -1
              ? 'rotate-ccw'
              : 'rotate-cw'
        }
        size={22}
        color="grey"
      />
      {!isSpeech && (
        <Text className="absolute text-[8px] font-bold text-grey" style={{ top: 20 }}>
          10
        </Text>
      )}
    </TouchableBox>
  )

  const chapter = (direction: 'previous' | 'next') => {
    const isAvailable = direction === 'previous' ? adjacent.previous : adjacent.next
    return (
      <TouchableBox
        className="w-[56px] h-[56px] items-center justify-center"
        disabled={!isAvailable}
        style={{ opacity: isAvailable ? 1 : 0.3 }}
        onPress={() => void goToAdjacentChapter(direction)}
        accessibilityRole="button"
        accessibilityLabel={t(
          direction === 'previous' ? 'accessibility.previousChapter' : 'accessibility.nextChapter'
        )}
        accessibilityState={{ disabled: !isAvailable }}
      >
        <IonIcon
          name={direction === 'previous' ? 'play-back' : 'play-forward'}
          size={36 * scale}
          color="default"
        />
      </TouchableBox>
    )
  }

  return (
    <HStack className="items-center justify-between">
      {step(-1)}
      {chapter('previous')}
      <TouchableBox
        className="items-center justify-center"
        style={{ width: 80 * scale, height: 80 * scale }}
        onPress={togglePlay}
        accessibilityRole="button"
        accessibilityLabel={t(
          isLoading
            ? 'accessibility.audioLoading'
            : isPlaying
              ? 'accessibility.pauseAudio'
              : 'accessibility.playAudio'
        )}
        accessibilityState={{ busy: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator size="large" />
        ) : (
          <IonIcon
            name={isPlaying ? 'pause' : 'play'}
            size={58 * scale}
            color="default"
            // The triangle's weight sits left of its box.
            style={isPlaying ? undefined : { marginLeft: 5 * scale }}
          />
        )}
      </TouchableBox>
      {chapter('next')}
      {step(1)}
    </HStack>
  )
}

/** The large options: what the version is heard with, its speed and settings, repeat, the timer. */
const Options = ({ passage }: { passage: BibleAudioPassage }) => {
  const { source } = useAtomValue(bibleAudioStateAtom)
  const isSpeech = source === 'speech'

  return (
    <HStack className="items-center justify-around">
      <AudioChoiceButton passage={passage} />
      {isSpeech ? (
        <>
          <TTSSpeedButton />
          <TTSVoiceButton currentVersion={passage.version} />
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
  )
}

const ErrorLine = () => {
  const { t } = useTranslation()
  const { status } = useAtomValue(bibleAudioStateAtom)
  if (status !== 'error') return null
  return (
    <Text className="text-[12px] text-grey text-center mt-[4px]">
      {t('bibleAudio.unavailable')}
    </Text>
  )
}

/** The cover fills the room left above the controls, and breathes in while it plays. */
const CoverStage = ({ passage }: { passage: BibleAudioPassage }) => {
  const { status } = useAtomValue(bibleAudioStateAtom)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const isPlaying = status === 'playing' || status === 'loading'
  const size = Math.floor(Math.min(room.width, room.height))

  const coverStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(isPlaying ? 1 : 0.84),
      },
    ],
  }))

  return (
    <Box
      className="flex-[1] items-center justify-center min-h-[0px]"
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout
        setRoom({ width, height })
      }}
    >
      {size > 0 && (
        <AnimatedBox style={[{ borderRadius: radii.sheet, ...floatingShadow }, coverStyle]}>
          <BibleAudioCover passage={passage} size={size} />
        </AnimatedBox>
      )}
    </Box>
  )
}

type BibleAudioPlayerContentProps = {
  /** `screen`: the full screen of a phone. `panel`: the panel of a wide screen. */
  layout: 'screen' | 'panel'
}

/** The large player: the cover, the passage, the bar, the transport and the options. */
const BibleAudioPlayerContent = ({ layout }: BibleAudioPlayerContentProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { passage } = useAtomValue(bibleAudioStateAtom)
  if (!passage) return null

  const part = getBiblePart(passage.book.Numero)
  const colors = getBiblePartColors(part, theme)

  if (layout === 'panel') {
    return (
      <Box>
        <HStack className="items-start">
          <Box style={{ borderRadius: radii.card, ...floatingShadow }}>
            <BibleAudioCover passage={passage} size={104} />
          </Box>
          <Box className="flex-[1] min-w-0 ml-[14px]">
            <Text
              className="text-[11px] text-grey uppercase font-medium"
              style={{ letterSpacing: 1.5 }}
              numberOfLines={1}
            >
              {t(`bibleAudio.part.${part}`)}
            </Text>
            <Box className="mt-[2px]">
              <PassageTitle passage={passage} size="medium" />
            </Box>
            <Box className="mt-[8px] self-start">
              <ReadButton compact />
            </Box>
          </Box>
          <HStack className="-mt-[10px] -mr-[10px]">
            <MoreMenu />
            <TouchableBox
              className="w-[44px] h-[44px] items-center justify-center"
              onPress={closeBibleAudioPlayer}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.reduceAudioPlayer')}
            >
              <FeatherIcon name="x" size={20} color="default" />
            </TouchableBox>
          </HStack>
        </HStack>
        <Box className="mt-[10px]">
          <BibleAudioProgressBar color={colors.accent} />
        </Box>
        <ErrorLine />
        <Box className="mt-[4px]">
          <Transport passage={passage} scale={0.85} />
        </Box>
        <Box className="mt-[6px]">
          <Options passage={passage} />
        </Box>
        <RecordingAttribution />
      </Box>
    )
  }

  return (
    <Box className="flex-[1]">
      <HStack className="items-center h-[44px] -mx-[10px]">
        <TouchableBox
          className="w-[44px] h-[44px] items-center justify-center"
          onPress={closeBibleAudioPlayer}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.reduceAudioPlayer')}
        >
          <FeatherIcon name="chevron-down" size={26} color="default" />
        </TouchableBox>
        <Text
          className="flex-[1] text-center text-[11px] text-grey uppercase font-medium"
          style={{ letterSpacing: 1.5 }}
          numberOfLines={1}
        >
          {t(`bibleAudio.part.${part}`)}
        </Text>
        <MoreMenu />
      </HStack>
      <Box className="flex-[1] py-[12px]">
        <CoverStage passage={passage} />
      </Box>
      <HStack className="items-center">
        <PassageTitle passage={passage} size="large" />
        <Box className="ml-[12px]">
          <ReadButton />
        </Box>
      </HStack>
      <Box className="mt-[14px]">
        <BibleAudioProgressBar color={colors.accent} />
      </Box>
      <ErrorLine />
      <Box className="mt-[10px]">
        <Transport passage={passage} />
      </Box>
      <Box className="mt-[14px]">
        <Options passage={passage} />
      </Box>
      <Box className="mt-[6px]">
        <RecordingAttribution />
      </Box>
    </Box>
  )
}

export default BibleAudioPlayerContent

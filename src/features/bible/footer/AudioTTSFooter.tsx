import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio'
import * as Speech from 'expo-speech'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { BibleTab, VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import * as Sentry from '@sentry/react-native'
import { Version, getVersions } from '~helpers/bibleVersions'
import {
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
} from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { useResourceAccess } from '~features/resources/resourceAccess'
import AudioContainer from './AudioContainer'
import BasicFooter from './BasicFooter'
import ChapterButton from './ChapterButton'
import PlayButton from './PlayButton'
import TTSPitchButton from './TTSPitchButton'
import TTSRepeatButton from './TTSRepeatButton'
import TTSSpeedButton from './TTSSpeedButton'
import TTSVoiceButton from './TTSVoiceButton'
import {
  playingBibleTabIdAtom,
  ttsPitchAtom,
  ttsRepeatAtom,
  ttsSpeedAtom,
  ttsVoiceAtom,
} from './atom'

type UseLoadSoundProps = {
  book: Book
  chapter: number
  version: VersionCode
  goToNextChapter: () => void
  goToPrevChapter: () => void
  bibleAtom: PrimitiveAtom<BibleTab>
}

// iOS workaround: play silent audio to enable TTS in silent mode
const silentPlayer: AudioPlayer | null =
  Platform.OS === 'ios' ? createAudioPlayer(require('~assets/sounds/empty.mp3')) : null

const useLoadSound = ({
  book,
  chapter,
  version,
  goToNextChapter,
  goToPrevChapter,
  bibleAtom,
}: UseLoadSoundProps) => {
  const bibleTab = useAtomValue(bibleAtom)
  const resources = useResourceAccess()
  const setPlayingBibleTabId = useSetAtom(playingBibleTabIdAtom)
  const currentVerseIndex = useRef(0)
  const verseKeys = useRef<number[]>([])
  const versesData = useRef<Record<number, string>>({})
  const isPlayingRef = useRef(false)
  const isRepeatRef = useRef(false)
  const goToNextChapterRef = useRef(goToNextChapter)
  const goToPrevChapterRef = useRef(goToPrevChapter)
  const speakVerseRef = useRef<((index: number) => void) | undefined>(undefined)
  const [, forceUpdate] = React.useReducer((i: number) => i + 1, 0)

  const [isExpanded, setExpandedMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(false)
  const selectedVoice = useAtomValue(ttsVoiceAtom)
  const rate = useAtomValue(ttsSpeedAtom)
  const pitch = useAtomValue(ttsPitchAtom)
  const isRepeat = useAtomValue(ttsRepeatAtom)
  const { t } = useTranslation()

  // Sync refs so callbacks always read the latest values
  isPlayingRef.current = isPlaying
  isRepeatRef.current = isRepeat
  goToNextChapterRef.current = goToNextChapter
  goToPrevChapterRef.current = goToPrevChapter

  // Speak a verse by index — chains via onDone (no effect re-trigger needed)
  const speakVerse = (index: number) => {
    const verseNum = verseKeys.current[index]
    const text = verseNum != null ? versesData.current[verseNum] : undefined

    if (text == null) {
      setIsPlaying(false)
      setError(true)
      return
    }

    currentVerseIndex.current = index
    forceUpdate()

    Speech.speak(text, {
      voice: selectedVoice !== 'default' ? selectedVoice : undefined,
      rate: rate ?? 1,
      pitch: pitch ?? 1,
      onError: () => {
        setError(true)
      },
      onStopped: () => {
        // Explicit stop via Speech.stop() — do not auto-advance.
        // The caller (effect cleanup, goToNextVerse, etc.) handles the next action.
      },
      onDone: () => {
        // Natural completion — advance to next verse
        if (!isPlayingRef.current) return
        if (verseKeys.current.length === 0) return // data was reset (chapter change)

        if (index >= verseKeys.current.length - 1) {
          if (isRepeatRef.current) {
            speakVerseRef.current?.(0)
          } else {
            currentVerseIndex.current = 0
            goToNextChapterRef.current()
          }
          return
        }

        speakVerseRef.current?.(index + 1)
      },
    })
  }
  speakVerseRef.current = speakVerse

  const onNextChapter = () => {
    currentVerseIndex.current = 0
    goToNextChapter()
  }

  const onPrevChapter = () => {
    currentVerseIndex.current = 0
    goToPrevChapter()
  }

  const onPlay = () => {
    setPlayingBibleTabId(bibleTab.id)
    setExpandedMode(true)
    if (!isPlaying) {
      isPlayingRef.current = true
      setIsPlaying(true)
    }
  }

  const onStop = () => {
    setPlayingBibleTabId('')
    isPlayingRef.current = false
    setIsPlaying(false)
  }

  const onReduce = () => {
    setExpandedMode(false)
  }

  const goToNextVerse = () => {
    if (currentVerseIndex.current < verseKeys.current.length - 1) {
      if (isPlayingRef.current) {
        Speech.stop()
        speakVerseRef.current?.(currentVerseIndex.current + 1)
      } else {
        currentVerseIndex.current += 1
        forceUpdate()
      }
    } else {
      onNextChapter()
    }
  }

  const goToPrevVerse = () => {
    if (currentVerseIndex.current > 0) {
      if (isPlayingRef.current) {
        Speech.stop()
        speakVerseRef.current?.(currentVerseIndex.current - 1)
      } else {
        currentVerseIndex.current -= 1
        forceUpdate()
      }
    } else {
      onPrevChapter()
    }
  }

  const bibleVersion = getVersions()[version] as Version

  const currentVerseNum = verseKeys.current[currentVerseIndex.current] ?? 1
  const audioTitle = `${t(book.Nom)} ${chapter}:${currentVerseNum} ${version}`
  const audioSubtitle = bibleVersion?.name

  // Effect 1: Load verse data when chapter/book/version changes
  useEffect(() => {
    let cancelled = false
    currentVerseIndex.current = 0
    verseKeys.current = []
    versesData.current = {}
    ;(async () => {
      try {
        const rows = await resources.bibleContent.loadChapterVerses(version, book.Numero, chapter)
        if (cancelled) return

        const obj: Record<number, string> = {}
        for (const row of rows) {
          obj[Number(row.Verset)] = row.Texte
        }
        const sorted = Object.keys(obj)
          .map(Number)
          .sort((a, b) => a - b)
        verseKeys.current = sorted
        versesData.current = obj

        // Auto-play if currently playing (e.g., chapter changed during playback)
        if (isPlayingRef.current) {
          if (Platform.OS === 'ios') {
            await setAudioModeAsync({ playsInSilentMode: true })
            if (cancelled) return
            silentPlayer?.play()
          }
          speakVerseRef.current?.(0)
        }
      } catch (e) {
        if (cancelled) return
        Sentry.withScope(scope => {
          scope.setExtra('Reference', `${book.Numero}-${chapter} ${version}`)
          Sentry.captureException(e)
        })
      }
    })()

    return () => {
      cancelled = true
      Speech.stop()
    }
  }, [book.Numero, chapter, version, resources.bibleContent])

  // Effect 2: Start/stop playback when user presses play/stop
  useEffect(() => {
    let cancelled = false
    if (isPlaying && verseKeys.current.length > 0) {
      ;(async () => {
        if (Platform.OS === 'ios') {
          await setAudioModeAsync({ playsInSilentMode: true })
          if (cancelled) return
          silentPlayer?.play()
        }
        speakVerseRef.current?.(currentVerseIndex.current)
      })()
    }

    return () => {
      cancelled = true
      Speech.stop()
    }
  }, [isPlaying])

  // Effect 3: Restart current verse when voice settings change mid-playback
  useEffect(() => {
    if (isPlayingRef.current && verseKeys.current.length > 0) {
      Speech.stop()
      speakVerseRef.current?.(currentVerseIndex.current)
    }
  }, [selectedVoice, rate, pitch])

  // Cleanup on unmount — stop TTS and clear playing state
  useEffect(() => {
    return () => {
      isPlayingRef.current = false
      Speech.stop()
      setPlayingBibleTabId('')
    }
  }, [setPlayingBibleTabId])

  return {
    error,
    isPlaying,
    isExpanded,
    onPlay,
    onStop,
    onReduce,
    goToNextVerse,
    goToPrevVerse,
    audioTitle,
    audioSubtitle,
    selectedVoice,
    onNextChapter,
    onPrevChapter,
  }
}

type AudioTTSFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  disabled?: boolean
  version: VersionCode
  onChangeMode?: React.Dispatch<React.SetStateAction<'tts' | 'url' | undefined>>
  bibleAtom: PrimitiveAtom<BibleTab>
  coverage?: BibleVersionCoverage
}

const AudioTTSFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  version,
  onChangeMode,
  bibleAtom,
  coverage,
}: AudioTTSFooterProps) => {
  const hasPreviousChapter = !!getPreviousAvailableChapterLocation(book, chapter, coverage)
  const hasNextChapter = !!getNextAvailableChapterLocation(book, chapter, coverage)

  const {
    error,
    isExpanded,
    isPlaying,
    onPlay,
    onStop,
    onReduce,
    goToNextVerse,
    goToPrevVerse,
    onNextChapter,
    onPrevChapter,
    audioTitle,
  } = useLoadSound({
    book,
    chapter,
    version,
    goToNextChapter,
    goToPrevChapter,
    bibleAtom,
  })

  if (!isExpanded) {
    return (
      <BasicFooter
        onPlay={onPlay}
        onPrevChapter={hasPreviousChapter ? onPrevChapter : undefined}
        onNextChapter={hasNextChapter ? onNextChapter : undefined}
        isPlaying={isPlaying}
        isDisabled={disabled}
        hasError={error}
        type="tts"
      />
    )
  }

  return (
    <AudioContainer onReduce={onReduce} audioMode="tts" onChangeMode={onChangeMode}>
      <Text color="grey" textAlign="center" fontSize={12} bold>
        {audioTitle}
      </Text>
      <Box flex row overflow="visible" center mt={10}>
        <ChapterButton
          disabled={disabled}
          hasNextChapter={hasPreviousChapter}
          direction="left"
          onPress={onPrevChapter}
        />
        <Box flex center overflow="visible" row>
          <TouchableBox
            disabled={disabled}
            activeOpacity={0.5}
            onPress={goToPrevVerse}
            width={40}
            height={40}
            center
          >
            <FeatherIcon name="chevron-left" size={18} color="tertiary" />
          </TouchableBox>
          <PlayButton
            error={error}
            isPlaying={isPlaying}
            disabled={disabled}
            onToggle={isPlaying ? onStop : onPlay}
          />
          <TouchableBox
            disabled={disabled}
            activeOpacity={0.5}
            onPress={goToNextVerse}
            width={40}
            height={40}
            center
          >
            <FeatherIcon name="chevron-right" size={18} color="tertiary" />
          </TouchableBox>
        </Box>
        <ChapterButton hasNextChapter={hasNextChapter} direction="right" onPress={onNextChapter} />
      </Box>
      <HStack alignItems="center" justifyContent="center" mt={10}>
        <TTSVoiceButton currentVersion={version} />
        <TTSSpeedButton />
        <TTSPitchButton />
        <TTSRepeatButton />
      </HStack>
    </AudioContainer>
  )
}

export default AudioTTSFooter

import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio'
import * as Speech from 'expo-speech'
import { useAtomValue } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import * as Sentry from '@sentry/react-native'
import { Version, getVersions } from '~helpers/bibleVersions'
import { getChapterVerses } from '~helpers/biblesDb'
import AudioContainer from './AudioContainer'
import BasicFooter from './BasicFooter'
import ChapterButton from './ChapterButton'
import PlayButton from './PlayButton'
import TTSPitchButton from './TTSPitchButton'
import TTSRepeatButton from './TTSRepeatButton'
import TTSSpeedButton from './TTSSpeedButton'
import TTSVoiceButton from './TTSVoiceButton'
import { ttsPitchAtom, ttsRepeatAtom, ttsSpeedAtom, ttsVoiceAtom } from './atom'

type UseLoadSoundProps = {
  book: Book
  chapter: number
  version: VersionCode
  goToNextChapter: () => void
  goToPrevChapter: () => void
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
}: UseLoadSoundProps) => {
  const ignoreSpeechDone = useRef(false)
  const totalVerses = useRef(0)
  const currentVerseIndex = useRef(0)
  const verseKeys = useRef<number[]>([])
  const [rendered, rerender] = React.useReducer(i => i + 1, 0)

  const [isExpanded, setExpandedMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(false)
  const selectedVoice = useAtomValue(ttsVoiceAtom)
  const rate = useAtomValue(ttsSpeedAtom)
  const pitch = useAtomValue(ttsPitchAtom)
  const isRepeat = useAtomValue(ttsRepeatAtom)
  const { t } = useTranslation()

  const onNextChapter = ({ ignoreDone }: { ignoreDone?: boolean } = {}) => {
    ignoreSpeechDone.current = ignoreDone ?? isPlaying
    currentVerseIndex.current = 0
    goToNextChapter()
  }

  const onPrevChapter = () => {
    ignoreSpeechDone.current = isPlaying
    currentVerseIndex.current = 0
    goToPrevChapter()
  }

  const onPlay = () => {
    ignoreSpeechDone.current = false
    setExpandedMode(true)
    if (!isPlaying) {
      setIsPlaying(true)
    }
  }

  const onStop = () => {
    ignoreSpeechDone.current = true
    setIsPlaying(false)
  }

  const onReduce = () => {
    setExpandedMode(false)
  }

  const goToNextVerse = () => {
    ignoreSpeechDone.current = true

    if (currentVerseIndex.current < totalVerses.current - 1) {
      currentVerseIndex.current += 1
      rerender()
    } else {
      onNextChapter()
    }
  }

  const goToPrevVerse = () => {
    ignoreSpeechDone.current = true

    if (currentVerseIndex.current > 0) {
      currentVerseIndex.current -= 1
      rerender()
    } else {
      goToPrevChapter()
    }
  }

  const bibleVersion = getVersions()[version] as Version

  const currentVerseNum = verseKeys.current[currentVerseIndex.current] ?? 1
  const audioTitle = `${t(book.Nom)} ${chapter}:${currentVerseNum} ${version}`
  const audioSubtitle = bibleVersion?.name

  useEffect(() => {
    currentVerseIndex.current = 0
    totalVerses.current = 0
    verseKeys.current = []
  }, [book.Numero, chapter, version])

  useEffect(() => {
    ;(async () => {
      try {
        if (isPlaying) {
          setError(false)

          const versesObj: Record<number, string> = {}
          const rows = await getChapterVerses(version, book.Numero, chapter)
          for (const row of rows) {
            versesObj[Number(row.Verset)] = row.Texte
          }

          const sortedKeys = Object.keys(versesObj)
            .map(Number)
            .sort((a, b) => a - b)
          verseKeys.current = sortedKeys
          totalVerses.current = sortedKeys.length

          const verseNum = sortedKeys[currentVerseIndex.current]
          const text = verseNum != null ? versesObj[verseNum] : undefined

          if (text == null) {
            setIsPlaying(false)
            setError(true)
            return
          }

          // IOS hack to play tts in silent mode
          if (Platform.OS === 'ios') {
            await setAudioModeAsync({
              playsInSilentMode: true,
            })
            silentPlayer?.play()
          }

          Speech.speak(text, {
            voice: selectedVoice !== 'default' ? selectedVoice : undefined,
            rate: rate ?? 1,
            pitch: pitch ?? 1,
            onError: () => {
              setError(true)
            },
            onDone: () => {
              // IOS detects any sound interruption as done
              if (ignoreSpeechDone.current && Platform.OS === 'ios') {
                ignoreSpeechDone.current = false
                return
              }

              if (currentVerseIndex.current >= totalVerses.current - 1) {
                if (isRepeat) {
                  currentVerseIndex.current = 0
                  rerender()
                } else {
                  onNextChapter({
                    ignoreDone: false,
                  })
                }

                return
              }

              currentVerseIndex.current += 1
              rerender()
            },
          })
        }
      } catch {
        Sentry.withScope(scope => {
          scope.setExtra('Reference', `${book.Numero}-${chapter} ${version}`)
          Sentry.captureException('AudioTTSFooter error')
        })
      }
    })()

    return () => {
      ;(async () => {
        Speech.stop()
        if (await Speech.isSpeakingAsync()) {
          ignoreSpeechDone.current = true
        }
      })()
    }
  }, [
    isPlaying,
    isRepeat,
    book.Numero,
    chapter,
    version,
    totalVerses,
    currentVerseIndex,
    selectedVoice,
    rate,
    pitch,
    rendered,
    onNextChapter,
  ])

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
}

const AudioTTSFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  version,
  onChangeMode,
}: AudioTTSFooterProps) => {
  const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)
  const hasNextChapter = !(book.Numero === 66 && chapter === 22)

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

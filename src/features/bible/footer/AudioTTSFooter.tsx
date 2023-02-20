import React, { memo, useEffect, useRef, useState } from 'react'

import * as Speech from 'expo-speech'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { getVersions, Version } from '~helpers/bibleVersions'
import loadBible from '~helpers/loadBible'
import { ttsPitchAtom, ttsRepeatAtom, ttsSpeedAtom, ttsVoiceAtom } from './atom'
import AudioContainer from './AudioContainer'
import BasicFooter from './BasicFooter'
import ChapterButton from './ChapterButton'
import PlayButton from './PlayButton'
import TTSPitchButton from './TTSPitchButton'
import TTSSpeedButton from './TTSSpeedButton'
import TTSVoiceButton from './TTSVoiceButton'
import TTSRepeatButton from './TTSRepeatButton'

type UseLoadSoundProps = {
  book: Book
  chapter: number
  version: VersionCode
  goToNextChapter: () => void
  goToPrevChapter: () => void
}

const useLoadSound = ({
  book,
  chapter,
  version,
  goToNextChapter,
  goToPrevChapter,
}: UseLoadSoundProps) => {
  const goingToNextVerse = useRef(false)
  const [currentVerse, setCurrentVerse] = useState(1)
  const [totalVerses, setTotalVerses] = useState(0)

  const [isExpanded, setExpandedMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(false)
  const selectedVoice = useAtomValue(ttsVoiceAtom)
  const rate = useAtomValue(ttsSpeedAtom)
  const pitch = useAtomValue(ttsPitchAtom)
  const isRepeat = useAtomValue(ttsRepeatAtom)
  const { t } = useTranslation()

  const onNextChapter = () => {
    setCurrentVerse(1)
    setTotalVerses(0)
    goToNextChapter()
  }

  const onPlay = () => {
    setExpandedMode(true)
    if (!isPlaying) {
      setIsPlaying(true)
    }
  }

  const onStop = () => {
    setIsPlaying(false)
  }

  const onReduce = () => {
    setExpandedMode(false)
  }

  const goToNextVerse = () => {
    goingToNextVerse.current = true

    if (currentVerse < totalVerses) {
      setCurrentVerse(currentVerse + 1)
    } else {
      onNextChapter()
    }
  }

  const goToPrevVerse = () => {
    if (currentVerse > 1) {
      setCurrentVerse(currentVerse - 1)
    } else {
      goToPrevChapter()
    }
  }

  const bibleVersion = getVersions()[version] as Version

  const audioTitle = `${t(book.Nom)} ${chapter}:${currentVerse} ${version}`
  const audioSubtitle = bibleVersion.name

  useEffect(() => {
    setCurrentVerse(1)
    setTotalVerses(0)
  }, [book.Numero, chapter, version])

  useEffect(() => {
    ;(async () => {
      if (isPlaying) {
        const bible = await loadBible(version)
        const verses = bible[book.Numero][chapter]
        setTotalVerses(Object.keys(verses).length)

        for (let i = currentVerse; i <= totalVerses; i++) {
          Speech.speak(verses[i], {
            voice: selectedVoice !== 'default' ? selectedVoice : undefined,
            rate,
            pitch,
            onStart: () => {
              setCurrentVerse(i)
            },
            onError: () => {
              setError(true)
            },
            onDone: () => {
              if (goingToNextVerse.current) {
                goingToNextVerse.current = false
                return
              }

              if (i === totalVerses) {
                if (isRepeat) {
                  setCurrentVerse(1)
                } else {
                  onNextChapter()
                }
              }
            },
          })
        }
      }
    })()

    return () => {
      Speech.stop()
    }
  }, [
    isPlaying,
    isRepeat,
    book.Numero,
    chapter,
    version,
    totalVerses,
    currentVerse,
    selectedVoice,
    rate,
    pitch,
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
        onPrevChapter={hasPreviousChapter ? goToPrevChapter : undefined}
        onNextChapter={hasNextChapter ? goToPrevChapter : undefined}
        isPlaying={isPlaying}
        isDisabled={disabled}
        hasError={error}
        type="tts"
      />
    )
  }

  return (
    <AudioContainer
      onReduce={onReduce}
      audioMode="tts"
      onChangeMode={onChangeMode}
    >
      <Text color="grey" textAlign="center" fontSize={12} bold>
        {audioTitle}
      </Text>
      <Box flex row overflow="visible" center mt={10}>
        <ChapterButton
          disabled={disabled}
          hasNextChapter={hasPreviousChapter}
          direction="left"
          onPress={goToPrevChapter}
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
        <ChapterButton
          hasNextChapter={hasNextChapter}
          direction="right"
          onPress={goToNextChapter}
        />
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

export default memo(AudioTTSFooter)

import React, { memo, useEffect, useRef, useState } from 'react'

import * as Speech from 'expo-speech'
import { useTranslation } from 'react-i18next'
import { VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import Link from '~common/Link'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getVersions, Version } from '~helpers/bibleVersions'
import loadBible from '~helpers/loadBible'
import AudioButton from './AudioButton'
import ChapterButton from './ChapterButton'
import Container from './Container'
import IconButton from './IconButton'
import PlayButton from './PlayButton'
import { HStack } from '~common/ui/Stack'
import DropdownMenu from '~common/DropdownMenu'

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
  const { t } = useTranslation()

  const onNextChapter = () => {
    setCurrentVerse(1)
    setTotalVerses(0)
    goToNextChapter()
  }

  const onPrevChapter = () => {
    setCurrentVerse(1)
    setTotalVerses(0)
    goToPrevChapter()
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
      // const list = await Speech.getAvailableVoicesAsync()
      // console.log(
      //   list.filter(
      //     l => l.language.startsWith('fr') || l.language.startsWith('en')
      //   )
      // )
      if (isPlaying) {
        const bible = await loadBible(version)
        const verses = bible[book.Numero][chapter]
        setTotalVerses(Object.keys(verses).length)

        for (let i = currentVerse; i <= totalVerses; i++) {
          Speech.speak(verses[i], {
            // voice: 'com.apple.speech.synthesis.voice.Junior',
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
                onNextChapter()
              }
            },
          })
        }
      }
    })()

    return () => {
      console.log('stop')
      Speech.stop()
    }
  }, [isPlaying, book.Numero, chapter, version, totalVerses, currentVerse])

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
  }
}

type AudioTTSFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  disabled?: boolean
  version: VersionCode
}

const AudioTTSFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  version,
}: AudioTTSFooterProps) => {
  const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)
  const hasNextChapter = !(book.Numero === 66 && chapter === 22)
  const { t } = useTranslation()

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

  return (
    <Container isExpanded={isExpanded}>
      {isExpanded && (
        <>
          <Box center>
            <Link onPress={onReduce} style={{ padding: 5 }}>
              <FeatherIcon name="chevron-down" size={20} color="tertiary" />
            </Link>
          </Box>
          <HStack center row>
            <Text color="grey" textAlign="center" fontSize={12} bold>
              {audioTitle}
            </Text>
            <TouchableBox>
              <FeatherIcon name="settings" size={12} />
            </TouchableBox>
          </HStack>
          <HStack my={10}>
            <TouchableBox center flex={1}>
              <Text color="grey" fontSize={12}>
                Voix
              </Text>
            </TouchableBox>
            <TouchableBox center flex={1}>
              <Text color="grey" fontSize={12}>
                Vitesse: 1.0
              </Text>
            </TouchableBox>
            <TouchableBox center flex={1}>
              <Text color="grey" fontSize={12}>
                Pitch 1.0
              </Text>
            </TouchableBox>
          </HStack>
        </>
      )}
      <Box flex row overflow="visible" center>
        <ChapterButton
          disabled={disabled}
          hasNextChapter={hasPreviousChapter}
          direction="left"
          onPress={goToPrevChapter}
          isExpanded={isExpanded}
        />
        <Box flex center overflow="visible" row>
          {!isExpanded && (
            <IconButton
              big={isPlaying}
              disabled={disabled}
              activeOpacity={0.5}
              onPress={onPlay}
              color={isPlaying ? 'primary' : ''}
            >
              <AudioButton isPlaying={isPlaying} error={error} type="tts" />
            </IconButton>
          )}
          {isExpanded && (
            <>
              <IconButton
                disabled={disabled}
                activeOpacity={0.5}
                onPress={goToPrevVerse}
                isFlat
              >
                <FeatherIcon name="chevron-left" size={18} color="tertiary" />
              </IconButton>
              <PlayButton
                error={error}
                isPlaying={isPlaying}
                disabled={disabled}
                onToggle={isPlaying ? onStop : onPlay}
              />
              <IconButton
                disabled={disabled}
                activeOpacity={0.5}
                onPress={goToNextVerse}
                isFlat
              >
                <FeatherIcon name="chevron-right" size={18} color="tertiary" />
              </IconButton>
            </>
          )}
        </Box>
        <ChapterButton
          hasNextChapter={hasNextChapter}
          direction="right"
          onPress={goToNextChapter}
          isExpanded={isExpanded}
        />
      </Box>
      {/* <DropdownMenu
        title={t('Pitch')}
        currentValue={pitch}
        setValue={setOrder}
        choices={orderValues}
      />
      <DropdownMenu
        title={t('Speed')}
        currentValue={order}
        setValue={setOrder}
        choices={orderValues}
      /> */}
    </Container>
  )
}

export default memo(AudioTTSFooter)

import React, { memo, useEffect, useState } from 'react'

import { Audio, AVPlaybackStatusError, AVPlaybackStatusSuccess } from 'expo-av'
import { useTranslation } from 'react-i18next'
import { VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import Link from '~common/Link'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { getVersions, Version } from '~helpers/bibleVersions'
import { usePrevious } from '~helpers/usePrevious'
import AudioBar from './AudioBar'
import AudioButton from './AudioButton'
import ChapterButton from './ChapterButton'
import Container from './Container'
import IconButton from './IconButton'
import PlayButton from './PlayButton'

type UseLoadSoundProps = {
  audioUrl?: string
  canPlayAudio?: boolean
  goToNextChapter?: () => void
  goToPrevChapter?: () => void
  audioTitle: string
  audioSubtitle: string
}

const useLoadSound = ({
  audioUrl,
  canPlayAudio,
  goToNextChapter,
  goToPrevChapter,
  audioTitle,
  audioSubtitle,
}: UseLoadSoundProps) => {
  const [isExpanded, setExpandedMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null)
  const [
    audioObject,
    setAudioObject,
  ] = useState<AVPlaybackStatusSuccess | null>(null)
  const previousAudioUrl = usePrevious(audioUrl)
  const { t } = useTranslation()

  // Audio init
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: 0,
      shouldDuckAndroid: true,
      interruptionModeAndroid: 2,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    })
  }, [])

  // Audio mode + audio url
  useEffect(() => {
    const loadSound = async () => {
      if (!audioUrl) {
        return
      }
      if (!isExpanded && !isPlaying) {
        return
      }
      if (isPlaying && audioUrl === previousAudioUrl) {
        return
      }

      try {
        console.log('AUDIO URL', audioUrl)

        if (soundObject) {
          await soundObject.stopAsync()
          await soundObject.unloadAsync()
          setSoundObject(null)
          setAudioObject(null)
          setIsLoading(true)
        }

        const s = new Audio.Sound()
        s.setOnPlaybackStatusUpdate(status => {
          if ((status as AVPlaybackStatusError).error) {
            setError(true)
          }

          setAudioObject(status as AVPlaybackStatusSuccess)
        })

        await s.loadAsync(
          {
            uri: audioUrl,
          },
          {},
          false
        )

        setIsLoading(false)
        setIsPlaying(true)
        s.playAsync()

        setError(false)
        setSoundObject(s)
      } catch (error) {
        console.log(error)

        setError(true)
        setIsLoading(false)

        SnackBar.show(
          t(
            'Impossible de lire le chapitre. Vérifiez votre connexion internet.'
          )
        )

        // TODO: check error to send to sentry
      }
    }

    loadSound()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, isExpanded])

  useEffect(() => {
    const playSound = async () => {
      if (!isPlaying && soundObject) {
        await soundObject.pauseAsync()
      }
    }

    playSound()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, soundObject])

  useEffect(() => {
    if (!canPlayAudio && soundObject) {
      setIsPlaying(false)
      soundObject.stopAsync()
      soundObject.unloadAsync()
      setSoundObject(null)
      setExpandedMode(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPlayAudio])

  useEffect(() => {
    if (audioObject?.didJustFinish && goToNextChapter) {
      goToNextChapter()
    }

    if (audioObject?.didJustFinish && !goToNextChapter) {
      setIsPlaying(false)
      soundObject?.stopAsync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioObject?.didJustFinish])

  const setPosition = (milli: number) => {
    if (soundObject && audioObject) {
      const position = audioObject.positionMillis + milli
      if (position < 0) {
        soundObject.setPositionAsync(0)
      } else if (
        audioObject?.durationMillis &&
        position > audioObject.durationMillis
      ) {
        soundObject.setPositionAsync(audioObject.durationMillis)
      } else {
        soundObject.setPositionAsync(position)
      }
    }
  }

  return {
    soundObject,
    audioObject,
    error,
    setPosition,
    isPlaying,
    setIsPlaying,
    isExpanded,
    setExpandedMode,
    isLoading,
    setIsLoading,
  }
}

type AudioUrlFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  disabled?: boolean
  version: VersionCode
}

const AudioUrlFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  version,
}: AudioUrlFooterProps) => {
  const bibleVersion = getVersions()[version] as Version
  const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)
  const hasNextChapter = !(book.Numero === 66 && chapter === 22)
  const { t } = useTranslation()
  const audioTitle = `${t(book.Nom)} ${chapter} ${version}`
  const canPlayAudio = bibleVersion.hasAudio
  const audioSubtitle = bibleVersion.name
  const audioUrl = bibleVersion.getAudioUrl?.(book.Numero, chapter)

  const {
    audioObject,
    error,
    setPosition,
    isPlaying,
    setIsPlaying,
    isExpanded,
    setExpandedMode,
    isLoading,
    setIsLoading,
  } = useLoadSound({
    audioUrl,
    canPlayAudio,
    goToNextChapter: hasNextChapter ? goToNextChapter : undefined,
    goToPrevChapter: hasPreviousChapter ? goToPrevChapter : undefined,
    audioTitle,
    audioSubtitle,
  })

  const isBuffering = isPlaying && !audioObject?.isPlaying

  return (
    <Container isExpanded={isExpanded}>
      {isExpanded && (
        <>
          <Box center>
            <Link onPress={() => setExpandedMode(false)} style={{ padding: 5 }}>
              <FeatherIcon name="chevron-down" size={20} color="tertiary" />
            </Link>
          </Box>
          <AudioBar
            durationMillis={audioObject?.durationMillis}
            positionMillis={audioObject?.positionMillis}
          />
        </>
      )}
      <Box flex row overflow="visible" center>
        <ChapterButton
          disabled={
            disabled || (isLoading && isExpanded) || (isLoading && isPlaying)
          }
          hasNextChapter={hasPreviousChapter}
          direction="left"
          onPress={() => {
            setIsLoading(true)
            goToPrevChapter()
          }}
          isExpanded={isExpanded}
        />
        <Box flex center overflow="visible" row>
          {canPlayAudio && !isExpanded && (
            <IconButton
              big={isPlaying}
              disabled={disabled}
              activeOpacity={0.5}
              onPress={() => {
                setExpandedMode(true)
              }}
              color={isPlaying ? 'primary' : ''}
            >
              <AudioButton
                isPlaying={isPlaying}
                isLoading={isLoading}
                isBuffering={isBuffering}
                error={error}
              />
            </IconButton>
          )}
          {isExpanded && (
            <>
              <IconButton
                disabled={disabled || isLoading}
                activeOpacity={0.5}
                onPress={() => setPosition(-5000)}
                isFlat
              >
                <FeatherIcon name="rewind" size={18} color="tertiary" />
              </IconButton>
              <PlayButton
                error={error}
                isLoading={isLoading || isBuffering}
                isPlaying={isPlaying}
                disabled={disabled}
                onToggle={() => setIsPlaying(!isPlaying)}
              />
              <IconButton
                disabled={disabled || isLoading}
                activeOpacity={0.5}
                onPress={() => setPosition(+5000)}
                isFlat
              >
                <FeatherIcon name="fast-forward" size={18} color="tertiary" />
              </IconButton>
            </>
          )}
        </Box>
        <ChapterButton
          disabled={
            disabled || (isLoading && isExpanded) || (isLoading && isPlaying)
          }
          hasNextChapter={hasNextChapter}
          direction="right"
          onPress={() => {
            setIsLoading(true)
            goToNextChapter()
          }}
          isExpanded={isExpanded}
        />
      </Box>
    </Container>
  )
}

export default memo(AudioUrlFooter)

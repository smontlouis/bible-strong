import React, { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'

import { Audio } from 'expo-av'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import MusicControl, { Command } from 'react-native-music-control'
import SnackBar from '~common/SnackBar'
import { usePrevious } from '~helpers/usePrevious'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { millisToMinutes } from '~helpers/millisToMinutes'
import { useTranslation } from 'react-i18next'
import books from '~assets/bible_versions/books-desc'
import { getVersions } from '~helpers/bibleVersions'

const Container = styled.View(({ audioMode, theme }) => ({
  position: 'absolute',
  bottom: 5,
  left: 0,
  right: 0,
  height: 60,
  paddingLeft: 10,
  paddingRight: 10,
  pointerEvents: 'box-none',
  zIndex: 1,

  ...(audioMode && {
    height: 120,
    backgroundColor: theme.colors.reverse,
    marginLeft: 0,
    marginRight: 0,
    // shadowColor: theme.colors.default,
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.3,
    // shadowRadius: 3,
    // elevation: 2,
    bottom: 0,
    paddingBottom: 20,
  }),
}))

const IconButton = styled.TouchableOpacity(
  ({ theme, big, noShadow, color }) => ({
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: color ? theme.colors[color] : theme.colors.reverse,

    ...(!noShadow && {
      shadowColor: theme.colors.default,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 2,
      overflow: 'visible',
    }),

    ...(big && {
      width: 50,
      height: 50,
      borderRadius: 25,
    }),
  })
)

const StyledIcon = styled(Icon.Feather)(({ theme, color }) => ({
  color: color ? theme.colors[color] : theme.colors.tertiary,
}))

const Progress = styled(Box)(({ progress, theme }) => ({
  width: `${progress}%`,
  position: 'absolute',
  top: 0,
  height: 4,
  left: 0,
  backgroundColor: theme.colors.primary,
}))

const useLoadSound = ({
  audioMode,
  audioUrl,
  isPlaying,
  setIsLoading,
  canPlayAudio,
  setIsPlaying,
  setAudioMode,
  goToNextChapter,
  goToPrevChapter,
  audioTitle,
  audioSubtitle,
}) => {
  const [soundObject, setSoundObject] = useState(null)
  const [audioObject, setAudioObject] = useState(null)
  const [error, setError] = useState(null)
  const previousAudioUrl = usePrevious(audioUrl)
  const { t } = useTranslation()

  // Audio init
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    })

    MusicControl.enableBackgroundMode(true)
    MusicControl.on(Command.play, () => setIsPlaying(true))
    MusicControl.on(Command.pause, () => setIsPlaying(false))
    MusicControl.on(Command.nextTrack, () => {
      goToNextChapter()
    })
    MusicControl.on(Command.previousTrack, () => {
      goToPrevChapter()
    })
  }, [])

  // Audio mode + audio url
  useEffect(() => {
    const loadSound = async () => {
      if (!audioUrl) {
        return
      }
      if (!audioMode && !isPlaying) {
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
          setAudioObject(false)
          setIsLoading(true)
        }

        const s = new Audio.Sound()
        s.setOnPlaybackStatusUpdate(setAudioObject)

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
        console.log(audioUrl)
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
  }, [audioUrl, audioMode])

  // Update music controls when duration is available
  useEffect(() => {
    if (audioObject?.durationMillis) {
      MusicControl.enableControl('play', true)
      MusicControl.enableControl('pause', true)
      MusicControl.enableControl('changePlaybackPosition', true)
      MusicControl.enableControl('skipForward', false)
      MusicControl.enableControl('skipBackward', false)
      MusicControl.enableControl('nextTrack', true)
      MusicControl.enableControl('previousTrack', true)

      MusicControl.setNowPlaying({
        title: audioTitle,
        artwork: require('~assets/images/icon.png'),
        artist: audioSubtitle,
        duration: audioObject.durationMillis / 1000,
      })
      MusicControl.updatePlayback({
        state: MusicControl.STATE_PLAYING,
        elapsedTime: audioObject.positionMillis / 1000,
      })
    } else {
      MusicControl.resetNowPlaying()
    }
  }, [audioObject?.durationMillis])

  useEffect(() => {
    const playSound = async () => {
      if (isPlaying && soundObject) {
        try {
          await soundObject.playAsync()
          MusicControl.updatePlayback({
            state: MusicControl.STATE_PLAYING,
            elapsedTime: audioObject.positionMillis / 1000,
          })
        } catch (e) {
          console.log(e)
        }
      }

      if (!isPlaying && soundObject) {
        try {
          await soundObject.pauseAsync()
          MusicControl.updatePlayback({
            state: MusicControl.STATE_PAUSED,
            elapsedTime: audioObject.positionMillis / 1000,
          })
        } catch (e) {
          console.log(e)
        }
      }
    }

    playSound()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  useEffect(() => {
    if (!canPlayAudio && soundObject) {
      setIsPlaying(false)
      soundObject.stopAsync()
      soundObject.unloadAsync()
      setSoundObject(null)
      setAudioMode(false)
      MusicControl.resetNowPlaying()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPlayAudio])

  useEffect(() => {
    if (audioObject?.didJustFinish && goToNextChapter) {
      goToNextChapter()
    }

    if (audioObject?.didJustFinish && !goToNextChapter) {
      setIsPlaying(false)
      soundObject.stopAsync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioObject?.didJustFinish])

  const setPosition = milli => {
    if (soundObject) {
      const position = audioObject.positionMillis + milli
      if (position < 0) {
        soundObject.setPositionAsync(0)
        MusicControl.updatePlayback({
          elapsedTime: 0,
        })
      } else if (position > audioObject.durationMillis) {
        soundObject.setPositionAsync(audioObject.durationMillis)
        MusicControl.updatePlayback({
          elapsedTime: audioObject.durationMillis / 1000,
        })
      } else {
        soundObject.setPositionAsync(position)
        MusicControl.updatePlayback({
          elapsedTime: position / 1000,
        })
      }
    }
  }

  return [soundObject, audioObject, error, setPosition]
}

const AudioBar = ({ audioObject }) => {
  const progress = audioObject
    ? (audioObject.positionMillis * 100) / audioObject.durationMillis
    : 0
  return (
    <>
      <Box height={4} position="relative" backgroundColor="rgba(0,0,0,0.2)">
        <Progress progress={progress} />
      </Box>
      <Box row marginTop={3}>
        <Text fontSize={10}>
          {audioObject &&
          typeof audioObject.positionMillis !== 'undefined' &&
          audioObject.positionMillis !== null
            ? millisToMinutes(audioObject.positionMillis)
            : '--:--'}
        </Text>
        <Box flex />
        <Text fontSize={10}>
          {audioObject && audioObject.durationMillis
            ? millisToMinutes(audioObject.durationMillis)
            : '--:--'}
        </Text>
      </Box>
    </>
  )
}

const PlayButton = ({
  disabled,
  isPlaying,
  setIsPlaying,
  error,
  isLoading,
  isBuffering,
}) => {
  if (error) {
    return (
      <IconButton big disabled={disabled} activeOpacity={0.5} noShadow>
        <StyledIcon name="x" size={23} color="quart" />
      </IconButton>
    )
  }
  // IsBuffering
  if (isLoading || isBuffering) {
    return (
      <Box width={50} height={50} center>
        <ActivityIndicator />
      </Box>
    )
  }

  return (
    <IconButton
      big
      disabled={disabled}
      activeOpacity={0.5}
      onPress={() => setIsPlaying(!isPlaying)}
      noShadow
    >
      <StyledIcon
        name={isPlaying ? 'pause' : 'play'}
        size={23}
        style={{ marginLeft: 3 }}
      />
    </IconButton>
  )
}

const OpenAudioModeButton = ({ error, isPlaying, isBuffering, isLoading }) => {
  if (error) {
    return (
      <StyledIcon
        name="x"
        size={20}
        color={isPlaying || isBuffering ? 'reverse' : ''}
      />
    )
  }

  if (isPlaying && (isLoading || isBuffering)) {
    return <ActivityIndicator color="white" />
  }

  return (
    <StyledIcon
      name={isPlaying || isBuffering ? 'volume-2' : 'volume-1'}
      style={{ marginLeft: 3 }}
      size={20}
      color={isPlaying || isBuffering ? 'reverse' : ''}
    />
  )
}

const BibleFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  audioMode,
  version,
  setAudioMode,
  isPlaying,
  setIsPlaying,
  audioUrl,
}) => {
  const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)
  const hasNextChapter = !(book.Numero === 66 && chapter === 22)
  const canPlayAudio = version === 'LSG'
  const [isLoading, setIsLoading] = useState(true)
  const { t } = useTranslation()
  const audioTitle = `${t(book.Nom)} ${chapter} ${version}`
  const audioSubtitle = getVersions()[version].name

  const [soundObject, audioObject, error, setPosition] = useLoadSound({
    audioMode,
    audioUrl,
    isPlaying,
    setIsLoading,
    canPlayAudio,
    setIsPlaying,
    setAudioMode,
    goToNextChapter: hasNextChapter && goToNextChapter,
    goToPrevChapter: hasPreviousChapter && goToPrevChapter,
    audioTitle,
    audioSubtitle,
  })

  const isBuffering = isPlaying && !audioObject?.isPlaying

  return (
    <Container audioMode={audioMode}>
      {audioMode && (
        <>
          <Box center>
            <Link onPress={() => setAudioMode(false)} style={{ padding: 5 }}>
              <StyledIcon name="chevron-down" size={20} />
            </Link>
          </Box>
          <Box position="relative">
            <AudioBar color="blue" audioObject={audioObject} />
          </Box>
        </>
      )}
      <Box flex row overflow="visible" center>
        <Box width={40} height={40} overflow="visible">
          {hasPreviousChapter && (
            <IconButton
              noShadow={audioMode}
              disabled={
                disabled || (isLoading && audioMode) || (isLoading && isPlaying)
              }
              activeOpacity={0.5}
              onPress={() => {
                setIsLoading(true)
                goToPrevChapter()
              }}
            >
              <StyledIcon name="arrow-left" size={20} />
            </IconButton>
          )}
        </Box>
        <Box flex center overflow="visible" row>
          {canPlayAudio && !audioMode && (
            <IconButton
              big={isPlaying}
              disabled={disabled}
              activeOpacity={0.5}
              onPress={() => {
                setAudioMode(true)
              }}
              color={isPlaying ? 'primary' : ''}
            >
              <OpenAudioModeButton
                {...{ error, isPlaying, isBuffering, isLoading }}
              />
            </IconButton>
          )}
          {audioMode && (
            <>
              <IconButton
                disabled={disabled || isLoading}
                activeOpacity={0.5}
                onPress={() => setPosition(-5000)}
                noShadow
              >
                <StyledIcon name="rewind" size={18} />
              </IconButton>
              <PlayButton
                {...{
                  disabled,
                  audioObject,
                  setIsPlaying,
                  isPlaying,
                  error,
                  isLoading,
                  isBuffering,
                }}
              />
              <IconButton
                disabled={disabled || isLoading}
                activeOpacity={0.5}
                onPress={() => setPosition(+5000)}
                noShadow
              >
                <StyledIcon name="fast-forward" size={18} />
              </IconButton>
            </>
          )}
        </Box>
        <Box width={40} height={40} overflow="visible">
          {hasNextChapter && (
            <IconButton
              noShadow={audioMode}
              disabled={
                disabled || (isLoading && audioMode) || (isLoading && isPlaying)
              }
              activeOpacity={0.5}
              onPress={() => {
                setIsLoading(true)
                goToNextChapter()
              }}
            >
              <StyledIcon name="arrow-right" size={20} />
            </IconButton>
          )}
        </Box>
      </Box>
    </Container>
  )
}

export default pure(BibleFooter)

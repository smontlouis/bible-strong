import React, { useEffect, useState } from 'react'
import { Audio, AVPlaybackStatus } from 'expo-av'
import { FeatherIcon } from '~common/ui/Icon'
import Box from '~common/ui/Box'
import { LinkBox } from '~common/Link'
import { ActivityIndicator } from 'react-native'
import SnackBar from '~common/SnackBar'
import to from 'await-to-js'

type AudioStatus = 'Idle' | 'Loading' | 'Playing' | 'Error'

interface Props {
  type: 'hebreu' | 'grec'
  code: number
}

const ListenToStrong = ({ type, code }: Props) => {
  const { current: soundObject } = React.useRef(new Audio.Sound())
  const codeId = `${code}`.padStart(4, '0')
  const url =
    type === 'hebreu'
      ? `https://content.swncdn.com/biblestudytools/audio/lexicons/hebrew-mp3/${codeId}h.mp3`
      : `https://content.swncdn.com/biblestudytools/audio/lexicons/greek-mp3/${codeId}g.mp3`

  const [audioStatus, setAudioStatus] = useState<AudioStatus>('Idle')
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    })
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        setAudioStatus('Loading')
        await soundObject.loadAsync({
          uri: url,
        })
        soundObject.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate)
        setAudioStatus('Idle')
      } catch (error) {
        setAudioStatus('Error')
      }
    })()
  }, [])

  const onPlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    if (!playbackStatus.isLoaded) {
      if (playbackStatus.error) {
        console.log(
          `Encountered a fatal error during playback: ${playbackStatus.error}`
        )
        setAudioStatus('Error')
        SnackBar.show("Impossible de lire l'audio", 'error')
      }
    } else {
      if (playbackStatus.isPlaying) {
        setAudioStatus('Playing')
      } else {
        setAudioStatus('Idle')
      }

      if (playbackStatus.isBuffering) {
        setAudioStatus('Loading')
      }

      if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
        setAudioStatus('Idle')
        soundObject.stopAsync()
      }
    }
  }

  const playAudio = async () => {
    const [err] = await to(soundObject.playAsync())
  }

  return (
    <Box>
      {audioStatus === 'Idle' && (
        <LinkBox onPress={playAudio}>
          <FeatherIcon name="play-circle" size={20} color="primary" />
        </LinkBox>
      )}
      {audioStatus === 'Loading' && (
        <Box width={20} height={20} center>
          <ActivityIndicator />
        </Box>
      )}
      {audioStatus === 'Playing' && (
        <Box>
          <FeatherIcon
            name="play-circle"
            size={20}
            color="primary"
            style={{ opacity: 0.5 }}
          />
        </Box>
      )}
      {audioStatus === 'Error' && (
        <LinkBox onPress={playAudio}>
          <FeatherIcon name="x-circle" size={20} color="grey" />
        </LinkBox>
      )}
    </Box>
  )
}

export default ListenToStrong

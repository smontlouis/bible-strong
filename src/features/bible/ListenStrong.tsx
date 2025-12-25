import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio'
import React, { useEffect, useRef } from 'react'
import { ActivityIndicator } from 'react-native'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'

type AudioStatus = 'Idle' | 'Loading' | 'Playing'

interface Props {
  type: 'hebreu' | 'grec'
  code: number
}

const ListenToStrong = ({ type, code }: Props) => {
  const codeId = `${code}`.padStart(4, '0')
  const url =
    type === 'hebreu'
      ? `https://content.swncdn.com/biblestudytools/audio/lexicons/hebrew-mp3/${codeId}h.mp3`
      : `https://content.swncdn.com/biblestudytools/audio/lexicons/greek-mp3/${codeId}g.mp3`

  const player = useAudioPlayer(url)
  const status = useAudioPlayerStatus(player)
  const hasFinishedRef = useRef(false)

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    })
  }, [])

  // Detect when playback finishes and reset
  useEffect(() => {
    if (
      status.duration > 0 &&
      status.currentTime >= status.duration &&
      !status.playing &&
      !hasFinishedRef.current
    ) {
      hasFinishedRef.current = true
      // Reset position for next play
      player.seekTo(0)
      player.pause()
    }
    // Reset the flag when playing starts again
    if (status.playing) {
      hasFinishedRef.current = false
    }
  }, [status.currentTime, status.duration, status.playing, player])

  const getAudioStatus = (): AudioStatus => {
    if (!status.isLoaded && !status.isBuffering) {
      return 'Idle'
    }
    if (status.isBuffering) {
      return 'Loading'
    }
    if (status.playing) {
      return 'Playing'
    }
    return 'Idle'
  }

  const audioStatus = getAudioStatus()

  const playAudio = async () => {
    try {
      player.play()
    } catch (error) {
      console.log('[Bible] Error playing audio:', error)
    }
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
          <FeatherIcon name="play-circle" size={20} color="primary" style={{ opacity: 0.5 }} />
        </Box>
      )}
    </Box>
  )
}

export default ListenToStrong

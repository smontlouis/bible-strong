import React from 'react'
import { ActivityIndicator } from 'react-native'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useStrongAudio } from './StrongAudioProvider'

type AudioStatus = 'Idle' | 'Loading' | 'Playing'

interface Props {
  type: 'hebreu' | 'grec'
  code: string | number
}

const ListenToStrong = ({ type, code }: Props) => {
  const codeId = `${code}`.padStart(4, '0')
  const audioId = `${type}-${codeId}`
  const url =
    type === 'hebreu'
      ? `https://content.swncdn.com/biblestudytools/audio/lexicons/hebrew-mp3/${codeId}h.mp3`
      : `https://content.swncdn.com/biblestudytools/audio/lexicons/greek-mp3/${codeId}g.mp3`

  const { getStatus, play } = useStrongAudio()
  const audioStatus = getStatus(audioId)

  const playAudio = () => {
    play({ id: audioId, url })
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

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import { useStrongAudio } from './StrongAudioProvider'

interface Props {
  type: 'hebreu' | 'grec'
  code: string | number
  iconSize?: number
  touchSize?: number
}

export const hasStrongAudio = (type: Props['type'], code: Props['code']) => {
  const numericCode = Number(code)
  const maximumCode = type === 'hebreu' ? 8674 : 5624

  return Number.isInteger(numericCode) && numericCode >= 1 && numericCode <= maximumCode
}

const ListenToStrong = ({ type, code, iconSize = 20, touchSize }: Props) => {
  const codeId = `${code}`.padStart(4, '0')
  const audioId = `${type}-${codeId}`
  const url =
    type === 'hebreu'
      ? `https://content.swncdn.com/biblestudytools/audio/lexicons/hebrew-mp3/${codeId}h.mp3`
      : `https://content.swncdn.com/biblestudytools/audio/lexicons/greek-mp3/${codeId}g.mp3`

  const { getStatus, play } = useStrongAudio()
  const { t } = useTranslation()
  const audioStatus = getStatus(audioId)

  if (!hasStrongAudio(type, code)) return null

  const playAudio = () => {
    play({ id: audioId, url })
  }

  const isLoading = audioStatus === 'Loading'
  const isPlaying = audioStatus === 'Playing'

  return (
    <LinkBox
      accessibilityLabel={
        isLoading
          ? t('accessibility.pronunciationLoading')
          : isPlaying
            ? t('accessibility.pronunciationPlaying')
            : t('accessibility.playPronunciation')
      }
      accessibilityState={{ busy: isLoading, disabled: isLoading || isPlaying }}
      disabled={isLoading || isPlaying}
      onPress={playAudio}
      style={{
        width: Math.max(touchSize ?? 44, 44),
        height: Math.max(touchSize ?? 44, 44),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {audioStatus === 'Idle' && (
        <IonIcon name="play" size={iconSize} color="primary" style={{ marginLeft: 2 }} />
      )}
      {audioStatus === 'Loading' && (
        <Box width={20} height={20} center>
          <ActivityIndicator />
        </Box>
      )}
      {audioStatus === 'Playing' && (
        <IonIcon
          name="play"
          size={iconSize}
          color="primary"
          style={{ opacity: 0.3, marginLeft: 2 }}
        />
      )}
    </LinkBox>
  )
}

export default ListenToStrong

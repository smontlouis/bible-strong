import * as Speech from 'expo-speech'
import { useAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { VersionCode } from 'src/state/tabs'
import DropdownMenu from '~common/DropdownMenu'
import { BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { versions } from '~helpers/bibleVersions'
import { timeout } from '~helpers/timeout'
import { ttsVoiceAtom } from './atom'
import AudioChip from './AudioChip'

export interface TTSVoiceButtonProps extends BoxProps {
  currentVersion: VersionCode
}

const filterToKnownLanguages = (versionCode: VersionCode) => (
  voice: Speech.Voice
) => {
  const bibleVersion = versions[versionCode]

  const knownLanguages = (() => {
    if (bibleVersion.type === 'en') return ['en-US', 'en-GB', 'en-AU']
    if (bibleVersion.type === 'fr') return ['fr-FR', 'fr-CA']

    return ['he-IL', 'el-GR']
  })()

  return knownLanguages.includes(voice.language)
}

const TTSVoiceButton = ({ currentVersion, ...props }: TTSVoiceButtonProps) => {
  const { t } = useTranslation()
  const [voices, setVoices] = React.useState<Speech.Voice[] | undefined>(
    undefined
  )
  const [selectedVoice, setSelectedVoice] = useAtom(ttsVoiceAtom)
  const choices =
    [
      {
        value: 'default',
        label: t('app.default'),
      },
      ...(voices
        ?.filter(filterToKnownLanguages(currentVersion))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(voice => ({
          value: voice.identifier,
          label: voice.name,
          subLabel: t(voice.language),
        })) || []),
    ] || []

  useEffect(() => {
    ;(async () => {
      await timeout(1000)
      const v = await Speech.getAvailableVoicesAsync()
      setVoices(v)
    })()
  }, [])

  const isActive = selectedVoice !== 'default'
  const voice = voices?.find(v => v.identifier === selectedVoice)
  return (
    <DropdownMenu
      title={t('audio.voice')}
      currentValue={selectedVoice}
      setValue={setSelectedVoice}
      choices={choices}
      customRender={
        <AudioChip isActive={isActive} {...props}>
          <FeatherIcon
            name="mic"
            size={14}
            color={isActive ? 'primary' : 'default'}
          />
          <Text
            ml={5}
            bold
            fontSize={10}
            color={isActive ? 'primary' : 'default'}
            numberOfLines={1}
          >
            {voice?.name || t('audio.voice')}
          </Text>
        </AudioChip>
      }
    />
  )
}

export default TTSVoiceButton

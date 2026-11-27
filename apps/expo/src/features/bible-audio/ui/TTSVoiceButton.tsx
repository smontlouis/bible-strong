import * as Speech from 'expo-speech'
import { useAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { VersionCode } from 'src/state/tabs'
import DropdownMenu from '~common/DropdownMenu'
import { versions } from '~helpers/bibleVersions'
import { timeout } from '~helpers/timeout'
import { appLogger } from '~helpers/agentObservability'
import { ttsVoiceAtom } from '../atoms'
import PlayerOption from './PlayerOption'
import { compareText } from '~helpers/compareText'
export interface TTSVoiceButtonProps {
  currentVersion: VersionCode
}

type VoiceChoice = {
  value: string
  label: string
  subLabel?: string
}

const filterToKnownLanguages = (versionCode: VersionCode) => (voice: Speech.Voice) => {
  const bibleVersion = versions[versionCode]

  const knownLanguages = (() => {
    if (bibleVersion.type === 'en') return ['en-US', 'en-GB', 'en-AU']
    if (bibleVersion.type === 'fr') return ['fr-FR', 'fr-CA']

    return ['he-IL', 'el-GR']
  })()

  return knownLanguages.includes(voice.language)
}

const TTSVoiceButton = ({ currentVersion }: TTSVoiceButtonProps) => {
  const { t } = useTranslation()
  const [voices, setVoices] = React.useState<Speech.Voice[] | undefined>(undefined)
  const [selectedVoice, setSelectedVoice] = useAtom(ttsVoiceAtom)
  const choices: VoiceChoice[] = [
    {
      value: 'default',
      label: t('app.default'),
    },
    ...(voices
      ?.filter(filterToKnownLanguages(currentVersion))
      .sort((a, b) => compareText(a.name, b.name))
      .map(voice => ({
        value: voice.identifier,
        label: voice.name,
        subLabel: t(voice.language),
      })) || []),
  ]

  useEffect(() => {
    ;(async () => {
      await timeout(1000)
      try {
        setVoices(await Speech.getAvailableVoicesAsync())
      } catch (error) {
        // Some Android speech engines list no voices at all. Speaking with a named voice then
        // fails natively, so the engine's default voice is used.
        appLogger.warn('unknown', 'tts.voices_unavailable', { error })
        setVoices([])
        setSelectedVoice('default')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; the atom setter is stable
  }, [])

  const isActive = selectedVoice !== 'default'
  return (
    <DropdownMenu
      searchable
      title={t('audio.voice')}
      currentValue={selectedVoice}
      setValue={setSelectedVoice}
      choices={choices}
      customRender={<PlayerOption isActive={isActive} icon="person-outline" />}
    />
  )
}

export default TTSVoiceButton

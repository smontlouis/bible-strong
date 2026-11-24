import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { getVersions, type Version } from '~helpers/bibleVersions'
import { bibleAudioStateAtom } from '../atoms'

/** What the players write about the passage: « Genèse 3 », and the version with the voice. */
export const useBibleAudioLabels = () => {
  const { t } = useTranslation()
  const { passage, source } = useAtomValue(bibleAudioStateAtom)
  if (!passage) return { title: '', subtitle: '' }

  const versionName = (getVersions()[passage.version] as Version | undefined)?.name
  return {
    title: `${t(passage.book.Nom)} ${passage.chapter}`,
    subtitle: [
      versionName ?? passage.version,
      source === 'speech' ? t('bibleAudio.speech') : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
  }
}

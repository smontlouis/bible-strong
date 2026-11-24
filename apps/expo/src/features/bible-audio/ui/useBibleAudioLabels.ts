import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { getVersions, type Version } from '~helpers/bibleVersions'
import { bibleAudioStateAtom } from '../atoms'
import { getRecording, getRecordingName, useVersionRecordings } from '../audioCatalog'

/** What the players write about the passage: « Genèse 3 », and the version with the voice. */
export const useBibleAudioLabels = () => {
  const { t } = useTranslation()
  const { passage, source, recordingId } = useAtomValue(bibleAudioStateAtom)
  const recordings = useVersionRecordings(passage?.version)
  if (!passage) return { title: '', subtitle: '', shortSubtitle: '' }

  const versionName = (getVersions()[passage.version] as Version | undefined)?.name
  const recording = getRecording(recordingId)
  // A recording is named when the version has several, or when it is not a plain reading.
  const voice =
    source === 'speech'
      ? t('bibleAudio.speech')
      : recording && (recordings.length > 1 || recording.kind !== 'reading')
        ? getRecordingName(recording)
        : undefined
  return {
    title: `${t(passage.book.Nom)} ${passage.chapter}`,
    subtitle: [versionName ?? passage.version, voice].filter(Boolean).join(' · '),
    /** The version by its code, « NEG79 », where the line is short. */
    shortSubtitle: [passage.version, voice].filter(Boolean).join(' · '),
  }
}

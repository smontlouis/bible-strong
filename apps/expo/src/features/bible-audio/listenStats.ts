import { trackAnalyticsEvent } from '~helpers/analytics'
import { SPEECH_CHOICE } from './audioCatalog'
import type { BibleAudioPassage } from './types'

/**
 * Counts the chapters heard, by recording, in the app's analytics (ADR-0117): the publishers who
 * lend their recordings ask for the number of listens once a year. A chapter counts once each time
 * it starts, not again when it resumes after a pause.
 */
export const createListenCounter = (
  track: (parameters: Record<string, string | number>) => void
) => {
  let lastHeard: string | undefined
  return (passage: BibleAudioPassage, recordingId: string | null) => {
    const recording = recordingId ?? SPEECH_CHOICE
    const heard = `${recording}|${passage.version}|${passage.book.Numero}|${passage.chapter}`
    if (heard === lastHeard) return
    lastHeard = heard
    track({
      recording,
      version: passage.version,
      book: passage.book.Numero,
      chapter: passage.chapter,
    })
  }
}

export const countBibleAudioListen = createListenCounter(
  parameters => void trackAnalyticsEvent('bible_audio_listen', parameters)
)

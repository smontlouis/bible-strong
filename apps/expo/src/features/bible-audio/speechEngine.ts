import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import * as Speech from 'expo-speech'
import { getDefaultStore } from 'jotai/vanilla'
import { Platform } from 'react-native'
import type { Verse } from '~common/types'
import { createSpeechChapter, type SpeechChapter } from './speechChapter'
import { ttsPitchAtom, ttsRepeatAtom, ttsSpeedAtom, ttsVoiceAtom } from './atoms'
import type {
  BibleAudioEngine,
  BibleAudioEngineEvents,
  BibleAudioPassage,
  BibleAudioStatus,
} from './types'

// iOS speaks in silent mode only while the app plays a sound of its own: a silent one.
let silentPlayer: AudioPlayer | null = null
const keepSpeakingInSilentMode = async () => {
  if (Platform.OS !== 'ios') return
  await setAudioModeAsync({ playsInSilentMode: true })
  silentPlayer ??= createAudioPlayer(require('~assets/sounds/empty.mp3'))
  silentPlayer.play()
}

/**
 * The device's voice reading the text of a version, a verse at a time, for the versions with no
 * recording. It loads the chapter itself: the reader may be elsewhere.
 */
export const createSpeechEngine = (
  events: BibleAudioEngineEvents,
  loadVerses: (passage: BibleAudioPassage) => Promise<Verse[]>
): BibleAudioEngine => {
  let chapter: SpeechChapter = { verseKeys: [], versesByNumber: {} }
  let index = 0
  let isPlaying = false
  // Each utterance carries the generation it was spoken in; a stop or a skip starts a new one, so
  // the end of an interrupted verse does not move on.
  let generation = 0
  let status: BibleAudioStatus = 'idle'
  let subscribed = false

  const setStatus = (next: BibleAudioStatus) => {
    if (next === status) return
    status = next
    events.onStatus(next)
  }

  const emitProgress = () => {
    events.onProgress({
      kind: 'verses',
      index,
      count: chapter.verseKeys.length,
      verse: chapter.verseKeys[index] ?? 1,
    })
  }

  const speak = (verseIndex: number) => {
    const verseNumber = chapter.verseKeys[verseIndex]
    const text = verseNumber != null ? chapter.versesByNumber[verseNumber] : undefined
    if (text == null) {
      isPlaying = false
      setStatus('error')
      return
    }

    index = verseIndex
    emitProgress()
    const spokenIn = ++generation
    const store = getDefaultStore()
    const voice = store.get(ttsVoiceAtom)

    Speech.speak(text, {
      voice: voice !== 'default' ? voice : undefined,
      rate: store.get(ttsSpeedAtom) ?? 1,
      pitch: store.get(ttsPitchAtom) ?? 1,
      onStart: () => {
        if (spokenIn === generation && isPlaying) setStatus('playing')
      },
      onError: () => {
        if (spokenIn !== generation) return
        isPlaying = false
        setStatus('error')
      },
      onDone: () => {
        if (spokenIn !== generation || !isPlaying) return
        if (index < chapter.verseKeys.length - 1) {
          speak(index + 1)
          return
        }
        if (store.get(ttsRepeatAtom)) {
          speak(0)
          return
        }
        isPlaying = false
        index = 0
        setStatus('ended')
        events.onEnded()
      },
    })
    // The web's voice gives no start event on every browser.
    if (Platform.OS === 'web') setStatus('playing')
  }

  const restartVerse = () => {
    if (!isPlaying) return
    generation++
    Speech.stop()
    speak(index)
  }

  const subscribeToSettings = () => {
    if (subscribed) return
    subscribed = true
    const store = getDefaultStore()
    store.sub(ttsVoiceAtom, restartVerse)
    store.sub(ttsSpeedAtom, restartVerse)
    store.sub(ttsPitchAtom, restartVerse)
  }

  const open = async (passage: BibleAudioPassage) => {
    subscribeToSettings()
    const wasPlaying = isPlaying
    isPlaying = false
    generation++
    Speech.stop()
    if (wasPlaying) setStatus('loading')

    const verses = await loadVerses(passage)
    chapter = createSpeechChapter(verses)
    index = 0
    if (!chapter.verseKeys.length) {
      throw new Error(`No text for ${passage.version} ${passage.book.Numero}:${passage.chapter}`)
    }
    emitProgress()
    setStatus('paused')
  }

  const play = async () => {
    if (isPlaying || !chapter.verseKeys.length) return
    isPlaying = true
    setStatus('loading')
    await keepSpeakingInSilentMode()
    if (!isPlaying) return
    speak(index)
  }

  const pause = () => {
    if (!isPlaying) return
    isPlaying = false
    generation++
    Speech.stop()
    setStatus('paused')
  }

  const stop = () => {
    isPlaying = false
    generation++
    Speech.stop()
    chapter = { verseKeys: [], versesByNumber: {} }
    index = 0
    status = 'idle'
  }

  const skip = (direction: -1 | 1) => {
    const target = Math.max(0, Math.min(index + direction, chapter.verseKeys.length - 1))
    if (direction === 1 && index >= chapter.verseKeys.length - 1) {
      // Past the last verse while it reads: on to the next chapter, as at the end of the verse.
      if (!isPlaying) return
      isPlaying = false
      generation++
      Speech.stop()
      events.onEnded()
      return
    }
    if (isPlaying) {
      generation++
      Speech.stop()
      speak(target)
      return
    }
    index = target
    emitProgress()
  }

  return { source: 'speech', open, play, pause, stop, skip }
}

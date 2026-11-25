import { getDefaultStore } from 'jotai/vanilla'
import type { Verse } from '~common/types'
import { resolveBibleCoverageCanonId } from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { defaultResourceAccess } from '~features/resources/resourceAccess'
import {
  audioSleepMinutesAtom,
  audioSleepTimeAtom,
  bibleAudioFollowingTabIdAtom,
  bibleAudioPlayerOpenAtom,
  bibleAudioProgressAtom,
  bibleAudioSourceTabIdAtom,
  bibleAudioStateAtom,
} from './atoms'
import {
  getRecording,
  recordingCoversBook,
  rememberBibleAudioChoice,
  resolveBibleAudio,
  SPEECH_CHOICE,
  type BibleAudioChoice,
  type BibleAudioRecording,
} from './audioCatalog'
import { watchBackgroundMusic } from './backgroundMusic'
import { countBibleAudioListen } from './listenStats'
import { createRecordedEngine } from './recordedEngine'
import { getAdjacentLocation, getFirstCoveredLocation } from './recordingNavigation'
import { createSpeechEngine } from './speechEngine'
import type {
  BibleAudioEngine,
  BibleAudioEngineEvents,
  BibleAudioPassage,
  BibleAudioSource,
  BibleAudioState,
} from './types'

/**
 * The one Bible audio player of the app (ADR-0116). It holds a passage of its own, whatever the
 * tabs show, and voices it with one of two engines behind the same calls: the recordings of the
 * version, or the device's voice for the versions that have none.
 */

const store = getDefaultStore()

const coverageByVersion = new Map<string, Promise<BibleVersionCoverage | undefined>>()
export const loadBibleAudioCoverage = (version: string) => {
  let coverage = coverageByVersion.get(version)
  if (!coverage) {
    coverage = defaultResourceAccess.bibleContent.loadCoverage(version).catch(() => {
      coverageByVersion.delete(version)
      return undefined
    })
    coverageByVersion.set(version, coverage)
  }
  return coverage
}

const loadVerses = async (passage: BibleAudioPassage): Promise<Verse[]> => {
  // Through the reader's own access: a Bible not downloaded is read online, as on screen.
  const result = await defaultResourceAccess.bibleContent.loadChapter({
    book: passage.book.Numero,
    chapter: passage.chapter,
    version: passage.version,
  })
  if (!result.success) throw new Error(`Cannot load ${passage.version} ${passage.book.Numero}`)
  return result.data.verses
}

const getState = () => store.get(bibleAudioStateAtom)
const setState = (partial: Partial<BibleAudioState>) =>
  store.set(bibleAudioStateAtom, { ...getState(), ...partial })

let current: BibleAudioEngine | null = null
const engines: Partial<Record<BibleAudioSource, BibleAudioEngine>> = {}
// Each load takes a number: an older one that finishes late changes nothing.
let loadToken = 0

const resetSleepTimer = () => {
  if (!store.get(audioSleepTimeAtom)) return
  store.set(audioSleepTimeAtom, 0)
  store.set(audioSleepMinutesAtom, 'off')
}

let sleepCheck: ReturnType<typeof setInterval> | undefined
const watchSleepTimer = (isPlaying: boolean) => {
  clearInterval(sleepCheck)
  if (!isPlaying) return
  sleepCheck = setInterval(() => {
    const sleepTime = store.get(audioSleepTimeAtom)
    if (sleepTime && Date.now() >= sleepTime) pause()
  }, 1000)
}

const createEvents = (source: BibleAudioSource): BibleAudioEngineEvents => ({
  onStatus: status => {
    if (current?.source !== source) return
    const previous = getState().status
    setState({ status })
    watchSleepTimer(status === 'playing')
    const { passage, recordingId } = getState()
    if (status === 'playing' && passage) countBibleAudioListen(passage, recordingId)
    // A pause from the lock screen also cancels the timer, as a pause in the app does.
    if (previous === 'playing' && status === 'paused') resetSleepTimer()
  },
  onProgress: progress => {
    if (current?.source === source) store.set(bibleAudioProgressAtom, progress)
  },
  onChapterChange: chapter => {
    const { passage } = getState()
    if (current?.source !== source || !passage || passage.chapter === chapter) return
    setState({ passage: { ...passage, chapter } })
    // The playlist moves to the next chapter while playing, without a new status.
    if (getState().status === 'playing')
      countBibleAudioListen({ ...passage, chapter }, getState().recordingId)
  },
  onEnded: () => {
    if (current?.source !== source) return
    void goToAdjacentChapter('next', { play: true })
  },
})

const getEngine = (source: BibleAudioSource) => {
  let engine = engines[source]
  if (!engine) {
    engine =
      source === 'recorded'
        ? createRecordedEngine(createEvents('recorded'), loadBibleAudioCoverage)
        : createSpeechEngine(createEvents('speech'), loadVerses)
    engines[source] = engine
  }
  return engine
}

export { isSamePassage } from './samePassage'

const isActive = () => {
  const { status } = getState()
  return status === 'playing' || status === 'loading'
}

/**
 * Readies a passage with what the reader listens to its version with (or the choice given),
 * keeping playback going if it was.
 */
const load = async (
  passage: BibleAudioPassage,
  options: { play: boolean; choice?: BibleAudioChoice }
) => {
  const token = ++loadToken
  watchBackgroundMusic()
  const { source, recording } = resolveBibleAudio(passage, options.choice)
  const engine = getEngine(source)
  // A recording that moves to another chapter of its book plays on without a pause.
  const playsOn = current === engine && getState().status === 'playing'
  if (current && current !== engine) current.stop()
  current = engine
  store.set(bibleAudioProgressAtom, null)
  setState({
    passage,
    source,
    recordingId: recording?.id ?? null,
    status: options.play && !playsOn ? 'loading' : getState().status,
  })

  try {
    await engine.open(passage, recording)
    if (token !== loadToken) return
    if (options.play) await engine.play()
    else if (getState().status !== 'playing') setState({ status: 'paused' })
  } catch (error) {
    if (token !== loadToken) return
    console.warn('[Bible audio] Cannot voice the passage:', error)
    setState({ status: 'error' })
  }
}

/**
 * Listens to a passage from a tab or a page: the player takes it, plays it and opens. The tab it
 * came from, if any, turns its pages with the audio.
 */
export const listenToPassage = (
  passage: BibleAudioPassage,
  options: { tabId?: string; open?: boolean } = {}
) => {
  store.set(bibleAudioSourceTabIdAtom, options.tabId ?? '')
  store.set(bibleAudioFollowingTabIdAtom, options.tabId ?? '')
  if (options.open !== false) store.set(bibleAudioPlayerOpenAtom, true)
  void load(passage, { play: true })
}

export const play = async () => {
  const { passage, status } = getState()
  if (!passage) return
  // Nothing left in the queue, or the last try failed: start the chapter again.
  if (!current || status === 'ended' || status === 'error') {
    await load(passage, { play: true, choice: currentChoice() })
    return
  }
  setState({ status: 'loading' })
  try {
    await current.play()
  } catch (error) {
    console.warn('[Bible audio] Cannot play:', error)
    setState({ status: 'error' })
  }
}

export function pause() {
  current?.pause()
  resetSleepTimer()
}

export const togglePlay = () => (isActive() ? pause() : void play())

/** Stops the Bible audio, lets go of the passage and hides the player. */
export const stop = () => {
  loadToken++
  current?.stop()
  current = null
  watchSleepTimer(false)
  resetSleepTimer()
  store.set(bibleAudioProgressAtom, null)
  store.set(bibleAudioPlayerOpenAtom, false)
  store.set(bibleAudioFollowingTabIdAtom, '')
  store.set(bibleAudioSourceTabIdAtom, '')
  setState({ passage: null, source: 'recorded', recordingId: null, status: 'idle' })
}

/** Ten seconds of a recording, or a verse of the device's voice. */
export const skip = (direction: -1 | 1) => current?.skip(direction)

/** A point of the chapter, from 0 to 1, as the progress bar gives it. */
export const seekTo = (ratio: number) => current?.seekTo(Math.max(0, Math.min(ratio, 1)))

/** The recording heard, when it covers only some books: the player keeps to them. */
const getPartialRecording = (recordingId: string | null) => {
  const recording = getRecording(recordingId)
  return recording?.books ? recording : undefined
}

/**
 * The chapter before or after, following the Bible, or the books of a partial recording when
 * `recording` is one: Proverbs 31 then John 1.
 */
export const getAdjacentPassage = async (
  passage: BibleAudioPassage,
  direction: 'previous' | 'next',
  recording?: BibleAudioRecording
): Promise<BibleAudioPassage | null> => {
  const coverage = await loadBibleAudioCoverage(passage.version)
  const canonId = resolveBibleCoverageCanonId(coverage, getBibleVersionCanonId(passage.version))
  const target = getAdjacentLocation(
    passage,
    direction,
    coverage,
    canonId,
    recording?.books ? book => recordingCoversBook(recording, book) : undefined
  )
  return target ? { version: passage.version, book: target.book, chapter: target.chapter } : null
}

export async function goToAdjacentChapter(
  direction: 'previous' | 'next',
  options: { play?: boolean } = {}
) {
  const { passage } = getState()
  if (!passage) return
  const shouldPlay = options.play ?? isActive()
  const { source, recordingId } = getState()
  const partial = source === 'recorded' ? getPartialRecording(recordingId) : undefined
  const target = await getAdjacentPassage(passage, direction, partial)
  if (!target) {
    // The end of the Bible.
    if (direction === 'next' && options.play) setState({ status: 'ended' })
    return
  }
  // Within a book, or through the books of a partial recording, the recording heard plays on;
  // another book takes the reader's choice again.
  await load(target, {
    play: shouldPlay,
    choice: partial || target.book.Numero === passage.book.Numero ? currentChoice() : undefined,
  })
}

/** Another chapter, book or version chosen in the player, keeping playback going if it was. */
export const changePassage = (passage: BibleAudioPassage) => {
  void load(passage, { play: isActive() })
}

/** What is heard now: the recording's id, or the device's voice. */
function currentChoice(): BibleAudioChoice {
  const { source, recordingId } = getState()
  return source === 'speech' || !recordingId ? SPEECH_CHOICE : recordingId
}

/**
 * Listens to the passage with another recording of its version or with the device's voice, and
 * remembers it for the version.
 */
export const chooseBibleAudio = async (choice: BibleAudioChoice) => {
  const { passage } = getState()
  if (!passage) return
  rememberBibleAudioChoice(passage.version, choice)
  if (choice === currentChoice()) return
  const recording = getRecording(choice)
  if (recording && !recordingCoversBook(recording, passage.book.Numero) && recording.books) {
    // A recording that skips the book heard opens on the first chapter it covers.
    const play = isActive()
    const coverage = await loadBibleAudioCoverage(passage.version)
    const canonId = resolveBibleCoverageCanonId(coverage, getBibleVersionCanonId(passage.version))
    const first = getFirstCoveredLocation(recording.books, coverage, canonId)
    if (first) void load({ version: passage.version, ...first }, { play, choice })
    return
  }
  void load(passage, { play: isActive(), choice })
}

/** Pauses the Bible audio for another sound, such as the pronunciation of a Strong word. */
export const interruptBibleAudio = () => {
  if (isActive()) pause()
}

export const openBibleAudioPlayer = () => store.set(bibleAudioPlayerOpenAtom, true)
export const closeBibleAudioPlayer = () => store.set(bibleAudioPlayerOpenAtom, false)

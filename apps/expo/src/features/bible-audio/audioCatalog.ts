import {
  chapterHasMusic,
  getBibleAudioUrl,
  getVersionRecordings,
  parseBibleAudioCatalog,
  recordingCoversBook,
  type BibleAudioCatalog,
  type BibleAudioMusic,
  type BibleAudioRecording,
} from '@bible-strong/resource-domain/bible-audio'
import {
  BIBLE_AUDIO_CATALOG_URL,
  BUNDLED_BIBLE_AUDIO_CATALOG,
} from '@bible-strong/resource-catalog/bible-audio'
import { useAtomValue } from 'jotai/react'
import { atom, getDefaultStore } from 'jotai/vanilla'
import { useEffect } from 'react'
import { getLanguage } from '~i18n'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { getVersions, type Version } from '~helpers/bibleVersions'
import type { BibleAudioPassage } from './types'

export type { BibleAudioRecording }

/** The device's voice: offered with every version, after its recordings. */
export const SPEECH_CHOICE = 'speech'

/** What a reader listens to a version with: one of its recordings, by id, or the device's voice. */
export type BibleAudioChoice = string

const REFRESH_INTERVAL = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT = 10_000

const bundledCatalog: BibleAudioCatalog = parseBibleAudioCatalog(BUNDLED_BIBLE_AUDIO_CATALOG) ?? {
  version: 1,
  recordings: [],
}

/** The last catalog read from the media host, kept on the device (ADR-0117). */
const storedCatalogAtom = atomWithAsyncStorage<{
  fetchedAt: number
  catalog: BibleAudioCatalog
  // Renamed with the second catalog: a copy of the first must not hide its recordings for a day.
} | null>('bibleAudioCatalogV2', null)

/** The catalog in use: the last one read, or the one this release carries. */
export const bibleAudioCatalogAtom = atom(get => get(storedCatalogAtom)?.catalog ?? bundledCatalog)

/** What the reader last listened to each version with, by version code. */
export const bibleAudioChoiceByVersionAtom = atomWithAsyncStorage<Record<string, BibleAudioChoice>>(
  'bibleAudioChoiceByVersion',
  {}
)

const store = getDefaultStore()

// One attempt per launch: a failure keeps the last copy until the next launch.
let refreshAttempted = false

export const refreshBibleAudioCatalog = async () => {
  if (refreshAttempted) return
  refreshAttempted = true
  const current = store.get(storedCatalogAtom)
  if (current && Date.now() - current.fetchedAt < REFRESH_INTERVAL) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const response = await fetch(BIBLE_AUDIO_CATALOG_URL, { signal: controller.signal })
    if (!response.ok) return
    const catalog = parseBibleAudioCatalog(await response.json())
    if (catalog) store.set(storedCatalogAtom, { fetchedAt: Date.now(), catalog })
  } catch {
    // Offline or unreachable: the last copy, or this release's, stays in use.
  } finally {
    clearTimeout(timeout)
  }
}

/** The recordings of a version, read live from the catalog in use. */
export const getRecordings = (version: string) =>
  getVersionRecordings(store.get(bibleAudioCatalogAtom), version)

export const getRecording = (id: string | null | undefined) =>
  id
    ? store.get(bibleAudioCatalogAtom).recordings.find(recording => recording.id === id)
    : undefined

/** Whether a version has a recording to play. */
export const hasRecordedAudio = (version: string) => getRecordings(version).length > 0

/** The recordings of a version, refreshed from the media host once a day. */
export const useVersionRecordings = (version: string | undefined) => {
  const catalog = useAtomValue(bibleAudioCatalogAtom)
  useEffect(() => {
    void refreshBibleAudioCatalog()
  }, [])
  return version ? getVersionRecordings(catalog, version) : []
}

/** A recording's name in the reader's language. */
export const getRecordingName = (recording: BibleAudioRecording) =>
  recording.name[getLanguage() === 'fr' ? 'fr' : 'en']

/** The mention its publisher asks for, in the reader's language, if it asks for one. */
export const getRecordingAttribution = (recording: BibleAudioRecording | undefined) => {
  if (!recording?.attribution) return undefined
  const { label, url, logo } = recording.attribution
  return { label: label[getLanguage() === 'fr' ? 'fr' : 'en'], url, logo }
}

export const getRecordingUrl = (recording: BibleAudioRecording, book: number, chapter: number) =>
  getBibleAudioUrl(recording, book, chapter)

export { recordingCoversBook }

export type { BibleAudioMusic }

/** The background music the catalog offers, in its order. */
export const useBackgroundMusicList = () => useAtomValue(bibleAudioCatalogAtom).music ?? []

export const getBackgroundMusic = (id: string | null | undefined) =>
  id ? store.get(bibleAudioCatalogAtom).music?.find(piece => piece.id === id) : undefined

/** A piece's name in the reader's language. */
export const getMusicName = (piece: BibleAudioMusic) =>
  piece.name[getLanguage() === 'fr' ? 'fr' : 'en']

/** Whether the chapter heard already has music under the voice, where the player adds none. */
export const passageHasMusic = (
  passage: BibleAudioPassage,
  recording: BibleAudioRecording | undefined
) => !!recording && chapterHasMusic(recording, passage.book.Numero, passage.chapter)

export type ResolvedBibleAudio =
  | { source: 'recorded'; recording: BibleAudioRecording }
  | { source: 'speech'; recording: null }

/**
 * What a passage is heard with. The choice asked, else the reader's last one for the version, else
 * its first recording. A recording that does not cover the book gives way to another of the
 * version that does, and the device's voice reads what no recording covers.
 */
export const resolveBibleAudio = (
  passage: BibleAudioPassage,
  asked?: BibleAudioChoice
): ResolvedBibleAudio => {
  const choice = asked ?? store.get(bibleAudioChoiceByVersionAtom)[passage.version]
  if (choice === SPEECH_CHOICE) return { source: 'speech', recording: null }
  const recordings = getRecordings(passage.version).filter(recording =>
    recordingCoversBook(recording, passage.book.Numero)
  )
  const recording = recordings.find(candidate => candidate.id === choice) ?? recordings[0]
  return recording ? { source: 'recorded', recording } : { source: 'speech', recording: null }
}

/** Remembers what the reader chose for a version. */
export const rememberBibleAudioChoice = (version: string, choice: BibleAudioChoice) =>
  store.set(bibleAudioChoiceByVersionAtom, {
    ...store.get(bibleAudioChoiceByVersionAtom),
    [version]: choice,
  })

/** The version's name, for the lock screen. */
export const getVersionName = (version: string) =>
  (getVersions()[version] as Version | undefined)?.name ?? version

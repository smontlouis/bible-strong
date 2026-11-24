import type { Book } from '~assets/bible_versions/books-desc'
import type { VersionCode } from '~state/tabs'

/** Where the voice comes from: a recording of the version, or the device reading the text. */
export type BibleAudioSource = 'recorded' | 'speech'

/** The chapter the Bible audio player holds. */
export type BibleAudioPassage = {
  version: VersionCode
  book: Book
  chapter: number
}

export type BibleAudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

export type BibleAudioState = {
  /** Absent: nothing is loaded and the player is hidden. */
  passage: BibleAudioPassage | null
  source: BibleAudioSource
  status: BibleAudioStatus
}

/**
 * Where playback stands in the chapter. A recording counts seconds; the device's voice counts
 * verses, `verse` being the number of the one it reads.
 */
export type BibleAudioProgress =
  | { kind: 'time'; position: number; duration: number }
  | { kind: 'verses'; index: number; count: number; verse: number }

/** What an engine tells the player. */
export type BibleAudioEngineEvents = {
  onStatus: (status: BibleAudioStatus) => void
  onProgress: (progress: BibleAudioProgress) => void
  /** The engine moved to another chapter of the passage's book on its own. */
  onChapterChange: (chapter: number) => void
  /** The engine played the last of what it holds and wants the next chapter. */
  onEnded: () => void
}

/**
 * One way of voicing a chapter. The player drives one engine at a time and keeps what both share:
 * the passage, the move from book to book, the sleep timer, the following tab.
 */
export interface BibleAudioEngine {
  readonly source: BibleAudioSource
  /** Readies the chapter, paused. A rejected promise means the chapter cannot be voiced. */
  open: (passage: BibleAudioPassage) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  /** Stops and lets go of everything, the lock screen controls included. */
  stop: () => void
  /** A step back or forward: ten seconds of a recording, a verse of the device's voice. */
  skip: (direction: -1 | 1) => void
}

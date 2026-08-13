import {
  loadAvatarLibrary,
  loadGlobalExpressions,
  parseExpressions,
  type AvatarLibrary,
} from './avatars'
import type { Expression } from './geometry'
import { loadSequences, normalizeSequencesForExpressions, type AvatarSequence } from './sequences'

export type StatePlaybackSelection = { stateId: string | null; playing: boolean }

export type StudioDocument = {
  version: 2
  library: AvatarLibrary
  expressions: Expression[]
  sequences: AvatarSequence[]
  playback: StatePlaybackSelection
}

export type StudioDocumentPatch = Partial<Omit<StudioDocument, 'version'>>

const DOCUMENT_STORAGE_KEY = 'bible-strong-avatar-studio-v2'
const LEGACY_PLAYBACK_STORAGE_KEY = 'bible-strong-avatar-state-playback-v1'

const defaultPlayback: StatePlaybackSelection = { stateId: 'idle', playing: true }

const parsePlayback = (
  value: unknown,
  fallback: StatePlaybackSelection = defaultPlayback
): StatePlaybackSelection => {
  const candidate = value as Partial<StatePlaybackSelection> | null
  if (!candidate || (typeof candidate.stateId !== 'string' && candidate.stateId !== null)) {
    return { ...fallback }
  }
  return { stateId: candidate.stateId, playing: candidate.playing === true }
}

export const parseStudioDocument = (value: unknown, fallback: StudioDocument): StudioDocument => {
  const candidate = value as Partial<StudioDocument> | null
  if (!candidate || candidate.version !== 2) return fallback
  const expressions =
    Array.isArray(candidate.expressions) && candidate.expressions.length
      ? parseExpressions(candidate.expressions)
      : fallback.expressions
  const sequences = Array.isArray(candidate.sequences)
    ? normalizeSequencesForExpressions(candidate.sequences, expressions)
    : fallback.sequences
  const library =
    candidate.library &&
    Array.isArray(candidate.library.avatars) &&
    candidate.library.avatars.length
      ? candidate.library
      : fallback.library
  return {
    version: 2,
    library,
    expressions,
    sequences,
    playback: parsePlayback(candidate.playback, fallback.playback),
  }
}

const loadLegacyPlayback = (): StatePlaybackSelection => {
  try {
    return parsePlayback(
      JSON.parse(window.localStorage.getItem(LEGACY_PLAYBACK_STORAGE_KEY) ?? 'null')
    )
  } catch {
    return { ...defaultPlayback }
  }
}

export const loadStudioDocument = (): StudioDocument => {
  const expressions = loadGlobalExpressions()
  const fallback: StudioDocument = {
    version: 2,
    library: loadAvatarLibrary(),
    expressions,
    sequences: normalizeSequencesForExpressions(loadSequences(expressions), expressions),
    playback: loadLegacyPlayback(),
  }
  try {
    return parseStudioDocument(
      JSON.parse(window.localStorage.getItem(DOCUMENT_STORAGE_KEY) ?? 'null'),
      fallback
    )
  } catch {
    return fallback
  }
}

export const persistStudioDocument = (document: StudioDocument) => {
  try {
    window.localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(document))
  } catch {
    // The in-memory document remains authoritative when storage is unavailable.
  }
}

export const createStudioDocumentStore = (
  initial: StudioDocument,
  persist: (document: StudioDocument) => void = persistStudioDocument
) => {
  let current = initial
  return {
    update: (patch: StudioDocumentPatch) => {
      const expressions = patch.expressions ?? current.expressions
      current = {
        ...current,
        ...patch,
        version: 2,
        expressions,
        sequences: normalizeSequencesForExpressions(
          patch.sequences ?? current.sequences,
          expressions
        ),
      }
      persist(current)
      return current
    },
  }
}

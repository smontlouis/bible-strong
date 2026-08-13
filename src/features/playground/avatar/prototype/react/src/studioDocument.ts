import { parseAvatarLibrary, parseExpressions, type AvatarLibrary } from './avatars'
import type { Expression } from './geometry'
import { normalizeSequencesForExpressions, parseSequences, type AvatarSequence } from './sequences'
import defaultStudioDocument from './defaultStudioDocument.json'

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
    ? normalizeSequencesForExpressions(
        parseSequences(candidate.sequences, expressions),
        expressions
      )
    : fallback.sequences
  const library = parseAvatarLibrary(candidate.library, fallback.library)
  return {
    version: 2,
    library,
    expressions,
    sequences,
    playback: parsePlayback(candidate.playback, fallback.playback),
  }
}

export const serializeStudioDocument = (document: StudioDocument) =>
  JSON.stringify(document, null, 2)

export const parseImportedStudioDocument = (
  source: string,
  fallback: StudioDocument
): StudioDocument => {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error('Invalid Avatar Studio project')
  }
  const candidate = value as Partial<StudioDocument> | null
  if (!candidate || candidate.version !== 2) {
    throw new Error('Unsupported Avatar Studio project')
  }
  if (
    !candidate.library ||
    !Array.isArray(candidate.library.avatars) ||
    !candidate.library.avatars.length ||
    !Array.isArray(candidate.expressions) ||
    !candidate.expressions.length ||
    !Array.isArray(candidate.sequences)
  ) {
    throw new Error('Invalid Avatar Studio project')
  }
  return parseStudioDocument(candidate, fallback)
}

const createBundledStudioDocument = () => {
  const snapshot = JSON.parse(JSON.stringify(defaultStudioDocument)) as StudioDocument
  return parseStudioDocument(snapshot, snapshot)
}

export const loadStudioDocument = (
  storage: Pick<Storage, 'getItem'> = window.localStorage
): StudioDocument => {
  const fallback = createBundledStudioDocument()
  try {
    return parseStudioDocument(
      JSON.parse(storage.getItem(DOCUMENT_STORAGE_KEY) ?? 'null'),
      fallback
    )
  } catch {
    return fallback
  }
}

export const persistStudioDocument = (document: StudioDocument) => {
  try {
    window.localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(document))
    return true
  } catch {
    // The in-memory document remains authoritative when storage is unavailable.
    return false
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

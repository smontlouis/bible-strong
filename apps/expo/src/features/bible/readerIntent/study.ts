import type { StudyIntent, StudyResource } from './types'
import type { Reader, ReaderSnapshot, ReaderWorld } from './world'

type StudyContext = { reader: Reader; snapshot: ReaderSnapshot; world: ReaderWorld }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const STUDY_RESOURCES: readonly string[] = [
  'compare',
  'strong',
  'reference',
  'commentary',
  'nave',
  'dictionary',
] satisfies StudyResource[]

const VERSE_KEY_PATTERN = /^\d+-\d+-\d+$/u

export const decodeStudyIntent = (value: unknown): StudyIntent | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.kind) {
    case 'study-verse':
      return Number.isSafeInteger(value.verse) && (value.verse as number) > 0
        ? { kind: value.kind, verse: value.verse as number }
        : undefined
    case 'open-resource':
      return typeof value.resource === 'string' &&
        STUDY_RESOURCES.includes(value.resource) &&
        typeof value.verseKey === 'string' &&
        VERSE_KEY_PATTERN.test(value.verseKey)
        ? { kind: value.kind, resource: value.resource as StudyResource, verseKey: value.verseKey }
        : undefined
    default:
      return undefined
  }
}

export const applyStudyIntent = (
  intent: StudyIntent,
  { reader, snapshot, world }: StudyContext
) => {
  switch (intent.kind) {
    case 'study-verse':
      reader.surface({ kind: 'studied-verse', verse: intent.verse })
      return
    case 'open-resource':
      // The resource sheet reads the verse in the version of the reading.
      reader.surface({
        kind: 'verse-resource',
        resource: intent.resource,
        verseKey: intent.verseKey,
        version: world.store.get(snapshot.tabAtom).data.selectedVersion,
      })
      return
  }
}

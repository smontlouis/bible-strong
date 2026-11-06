import { produce } from 'immer'
import type { Verse } from '~common/types'
import generateUUID from '~helpers/generateUUID'
import { getTokenByWordIndex, tokenizeVerseText } from '~helpers/wordTokenizer'
import {
  addWordAnnotation,
  removeWordAnnotationsInRangeAction,
  type AnnotationRange,
} from '~redux/modules/user/wordAnnotations'
import { clearVerseSelection } from '~state/bibleTabRecipes'
import type { VersionCode } from '~state/tabs'
import {
  enterAnnotationSession,
  exitAnnotationSession,
  markAnnotationCreated,
  markAnnotationSelectionErased,
  selectAnnotation,
  updateAnnotationSelection,
} from '../hooks/annotationSession'
import { getVersionOnScreen } from './columns'
import type {
  AnnotateIntent,
  ReaderRule,
  WordAnnotationType,
  WordPosition,
  WordRange,
  WordSelection,
} from './types'
import type { ReaderSnapshot, ReaderWorld } from './world'

type AnnotateContext = { snapshot: ReaderSnapshot; world: ReaderWorld }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const isWordIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const ANNOTATION_TYPES: readonly WordAnnotationType[] = ['background', 'underline', 'circle']

const isAnnotationType = (value: unknown): value is WordAnnotationType =>
  ANNOTATION_TYPES.includes(value as WordAnnotationType)

/** An optional version: absent, or a non-empty string. */
const decodeVersion = (value: unknown): { version?: string } | undefined => {
  if (value === undefined) return {}
  return isText(value) ? { version: value } : undefined
}

const decodeWordPosition = (value: unknown): WordPosition | undefined =>
  isRecord(value) && isText(value.verseKey) && isWordIndex(value.wordIndex)
    ? { verseKey: value.verseKey, wordIndex: value.wordIndex }
    : undefined

const decodeWordSelection = (value: unknown): WordSelection | null | undefined => {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const start = decodeWordPosition(value.start)
  const end = decodeWordPosition(value.end)
  const version = decodeVersion(value.version)
  return start && end && version ? { start, end, ...version } : undefined
}

const decodeWordRange = (value: unknown): WordRange | undefined =>
  isRecord(value) &&
  isText(value.verseKey) &&
  isWordIndex(value.startWordIndex) &&
  isWordIndex(value.endWordIndex) &&
  value.startWordIndex <= value.endWordIndex
    ? {
        verseKey: value.verseKey,
        startWordIndex: value.startWordIndex,
        endWordIndex: value.endWordIndex,
      }
    : undefined

const decodeWordRanges = (value: unknown): WordRange[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const ranges = value.map(decodeWordRange)
  return ranges.every((range): range is WordRange => range !== undefined) ? ranges : undefined
}

export const decodeAnnotateIntent = (value: unknown): AnnotateIntent | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.kind) {
    case 'enter-annotation-mode': {
      const version = decodeVersion(value.version)
      if (!version) return undefined
      if (value.verseKey !== undefined && !isText(value.verseKey)) return undefined
      return {
        kind: value.kind,
        ...version,
        ...(isText(value.verseKey) && { verseKey: value.verseKey }),
      }
    }
    case 'exit-annotation-mode':
      return { kind: value.kind }
    case 'change-word-selection': {
      const selection = decodeWordSelection(value.selection)
      return selection === undefined ? undefined : { kind: value.kind, selection }
    }
    case 'create-word-annotation': {
      const ranges = decodeWordRanges(value.ranges)
      const version = decodeVersion(value.version)
      if (!ranges || !version || !isText(value.color) || !isAnnotationType(value.type)) {
        return undefined
      }
      return { kind: value.kind, ranges, color: value.color, type: value.type, ...version }
    }
    case 'erase-word-annotations': {
      const start = decodeWordPosition(value.start)
      const end = decodeWordPosition(value.end)
      const version = decodeVersion(value.version)
      return start && end && version ? { kind: value.kind, start, end, ...version } : undefined
    }
    case 'select-word-annotation':
      if (value.annotationId !== null && !isText(value.annotationId)) return undefined
      return { kind: value.kind, annotationId: value.annotationId }
    default:
      return undefined
  }
}

/** The version an intent names: the one its words were touched or selected in. */
const getNamedVersion = (intent: AnnotateIntent): string | undefined => {
  switch (intent.kind) {
    case 'enter-annotation-mode':
    case 'create-word-annotation':
    case 'erase-word-annotations':
      return intent.version
    case 'change-word-selection':
      return intent.selection?.version
    default:
      return undefined
  }
}

const getVerseKey = (verse: Pick<Verse, 'Livre' | 'Chapitre' | 'Verset'>) =>
  `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

/** The version the words are annotated in: the one named when a column shows it. */
const getAnnotatedVersion = (
  { snapshot, world }: AnnotateContext,
  version: string | undefined
): VersionCode =>
  getVersionOnScreen(snapshot, world.store.get(snapshot.tabAtom).data.selectedVersion, version)

/**
 * The words of each range, read from the verse text the reader holds for the version: from the
 * first character of its first word to the last of its last, the spaces and line breaks between
 * them kept. Undefined when a verse or a word is not there.
 */
const readWordRanges = (
  verses: Verse[] | undefined,
  ranges: WordRange[]
): AnnotationRange[] | undefined => {
  const read: AnnotationRange[] = []
  for (const range of ranges) {
    const verse = verses?.find(candidate => getVerseKey(candidate) === range.verseKey)
    if (!verse?.Texte) return undefined
    const tokens = tokenizeVerseText(verse.Texte)
    const startToken = getTokenByWordIndex(tokens, range.startWordIndex)
    const endToken = getTokenByWordIndex(tokens, range.endWordIndex)
    if (!startToken || !endToken) return undefined
    read.push({ ...range, text: verse.Texte.substring(startToken.charStart, endToken.charEnd) })
  }
  return read
}

/**
 * Word annotations are personal Bible data (ADR-0030): none while the reader hides it, none in a
 * version shown only in interlinear presentations, and none over words the reader does not hold.
 */
export const getAnnotateRefusal = (
  intent: AnnotateIntent,
  context: AnnotateContext
): ReaderRule | undefined => {
  const { snapshot } = context
  if (snapshot.hidesPersonalData) return 'personal-data'
  const version = getNamedVersion(intent)
  if (version && snapshot.interlinearReadingVersions.includes(version)) {
    return 'interlinear-column'
  }
  if (intent.kind === 'create-word-annotation') {
    const annotatedVersion = getAnnotatedVersion(context, intent.version)
    if (!readWordRanges(snapshot.versesByVersion[annotatedVersion], intent.ranges)) {
      return 'words-not-on-screen'
    }
  }
  return undefined
}

export const applyAnnotateIntent = (intent: AnnotateIntent, context: AnnotateContext) => {
  const { snapshot, world } = context
  const { store } = world
  const session = snapshot.annotationSession
  switch (intent.kind) {
    case 'enter-annotation-mode': {
      const version = getAnnotatedVersion(context, intent.version)
      // The selected verses are let go: the words take over.
      if (Object.keys(store.get(snapshot.tabAtom).data.selectedVerses).length > 0) {
        store.set(
          snapshot.tabAtom,
          produce(draft => {
            clearVerseSelection(draft.data)
          })
        )
      }
      store.set(session, enterAnnotationSession(version, intent.verseKey))
      return
    }
    case 'exit-annotation-mode':
      store.set(session, exitAnnotationSession())
      return
    case 'change-word-selection':
      store.set(session, prev =>
        updateAnnotationSelection(prev, intent.selection !== null, intent.selection)
      )
      return
    case 'create-word-annotation': {
      const version = getAnnotatedVersion(context, intent.version)
      const verses = snapshot.versesByVersion[version]
      const ranges = readWordRanges(verses, intent.ranges)
      if (!ranges) throw new Error('WORD_ANNOTATION_WORDS_NOT_ON_SCREEN')
      const id = generateUUID()
      world.dispatch(
        addWordAnnotation({
          id,
          version,
          ranges,
          color: intent.color,
          type: intent.type,
          textRevision: verses?.find(verse => verse.TextRevision)?.TextRevision,
        })
      )
      store.set(session, prev => markAnnotationCreated(prev, id))
      return
    }
    case 'erase-word-annotations': {
      const version = getAnnotatedVersion(context, intent.version)
      world.dispatch(removeWordAnnotationsInRangeAction(version, intent.start, intent.end))
      store.set(session, markAnnotationSelectionErased)
      return
    }
    case 'select-word-annotation':
      store.set(session, prev => selectAnnotation(prev, intent.annotationId))
      return
  }
}

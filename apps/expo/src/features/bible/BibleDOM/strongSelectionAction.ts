import { createStrongSelection, type StrongSelectionContext } from '~helpers/strongSelection'
import type { StrongIdentity } from '~helpers/strongIdentities'
import type { ReaderIntent } from '../readerIntent/types'

type SendReaderIntent = (intent: ReaderIntent) => unknown

export const getStrongSelectionWordFromTextSegment = (
  textSegment: string | undefined
): string | undefined => {
  const word = textSegment
    ?.trim()
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '')
    .trim()
  return word || undefined
}

/** A word of the text opens its Strong entries, with the verse and the version it was read in. */
export const openStrongWord = (
  send: SendReaderIntent,
  identities: readonly StrongIdentity[],
  book: string | number,
  version: string,
  context: StrongSelectionContext = {}
) => {
  const selection = createStrongSelection(identities, book, version, context)
  if (!selection) return

  void send({
    kind: 'open',
    origin: 'text',
    target: {
      kind: 'strong-word',
      identities: selection.identities,
      ...(selection.morphologies && { morphologies: selection.morphologies }),
      ...(selection.word && { word: selection.word }),
      ...(selection.occurrenceId && { occurrenceId: selection.occurrenceId }),
    },
    verseKey: `${selection.book}-${context.chapter}-${context.verse}`,
    version: selection.version,
  })
}

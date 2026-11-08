import type { ReadingContext } from './conversations'

/** How a reading context is named, in the composer and under the question it went with. */
export const contextCaption = (value: ReadingContext) =>
  ['passage', 'word'].includes(value.kind) ? value.detail : value.label

/** What a context is, at a glance: a resource's own mark, or a plain symbol. */
export type ContextMark =
  | { resource: 'strong' | 'dictionary' | 'nave' | 'commentary' }
  | { symbol: 'book' | 'calendar' | 'sunrise' | 'user' | 'place' | 'clock' }

export const contextMark = (kind: ReadingContext['kind']): ContextMark => {
  switch (kind) {
    case 'word':
      return { resource: 'strong' }
    case 'commentary':
    case 'dictionary':
    case 'nave':
      return { resource: kind }
    case 'plan':
      return { symbol: 'calendar' }
    case 'meditation':
      return { symbol: 'sunrise' }
    case 'entity':
    case 'person':
      return { symbol: 'user' }
    case 'place':
      return { symbol: 'place' }
    case 'timeline':
      return { symbol: 'clock' }
    default:
      return { symbol: 'book' }
  }
}

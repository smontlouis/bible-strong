import type { ResourceSuggestion } from '@bible-strong/ai-contract/contract'

/** Where a suggested resource opens in the app. */
export function suggestionRoute(item: ResourceSuggestion) {
  switch (item.kind) {
    case 'media':
      return {
        pathname: '/passage-media-player' as const,
        params: { workId: item.id, language: item.language },
      }
    case 'reading':
      return { pathname: '/plan' as const, params: { planId: item.id } }
    case 'dictionary':
      return {
        pathname: '/dictionnary-detail' as const,
        params: { work: item.work, entryId: item.id, word: item.word, language: item.language },
      }
    case 'commentary':
      return {
        pathname: '/commentary-chapter' as const,
        params: {
          projectionId: `${item.id}:${item.language}`,
          book: String(item.book),
          chapter: String(item.chapter),
        },
      }
    case 'nave':
      return {
        pathname: '/nave-detail' as const,
        params: { name: item.id, name_lower: item.id, language: item.language },
      }
  }
}

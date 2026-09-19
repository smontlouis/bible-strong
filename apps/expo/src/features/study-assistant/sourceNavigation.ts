import verseToReference from '~helpers/verseToReference'
import { parseStudySource, type StudySource } from '@bible-strong/ai-contract/contract'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
export function sourceRoute(value: StudySource) {
  const source = parseStudySource(value),
    p = source.params
  switch (source.kind) {
    case 'passage':
      return {
        pathname: '/bible-view' as const,
        params: {
          book: p.book,
          chapter: p.chapter,
          verse: p.start,
          focusVerses: JSON.stringify(
            Array.from(
              { length: Number(p.end) - Number(p.start) + 1 },
              (_, i) => Number(p.start) + i
            )
          ),
          version: source.version || 'LSG',
          contextDisplayMode: 'focused',
        },
      }
    case 'commentary':
      return {
        pathname: '/commentary-entry' as const,
        params: {
          projectionId: `${p.resourceId}:fr`,
          book: p.book,
          chapter: p.chapter,
          sectionId: p.sectionId,
        },
      }
    case 'dictionary':
      return {
        pathname: '/dictionnary-detail' as const,
        params: { work: p.work, entryId: p.entryId, word: p.word, language: 'fr' },
      }
    case 'strong':
      return createStrongDetailRoute('index', {
        book: p.code.startsWith('G') ? 40 : 1,
        identityCode: p.code,
        identityKind: p.identityKind as 'strong' | 'dstrong' | 'estrong' | 'ustrong',
      })
  }
}

export function sourceDisplayTitle(source: StudySource) {
  return (
    source.kind === 'commentary' || source.kind === 'passage'
      ? source.title.replace(
          `${source.params.book}:${source.params.chapter}`,
          verseToReference({
            bookNum: Number(source.params.book),
            chapterNum: Number(source.params.chapter),
          })
        )
      : source.title
  ).replace(/:(\d+)–\1(?=\D|$)/u, ':$1')
}

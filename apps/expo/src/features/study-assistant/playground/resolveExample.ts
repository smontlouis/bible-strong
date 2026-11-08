import {
  parseStudyWidget,
  type StudySource,
  type StudyWidget,
} from '@bible-strong/ai-contract/contract'
import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'

// Native counterpart of resolveExample.web.ts: the same real excerpts, without a DOM parser.
const NAMED: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  rsquo: '’',
  lsquo: '‘',
  laquo: '«',
  raquo: '»',
  lt: '<',
  gt: '>',
}
const excerpt = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&([a-z]+);/gi, (entity, name) => NAMED[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)

/** Fills the sources of a demo card with real commentary and dictionary excerpts. */
export async function resolveExample(
  widget: StudyWidget,
  resources: ResourceAccessRegistry
): Promise<StudyWidget> {
  if (widget.kind === 'commentary_comparison') {
    const result = await resources.commentaryReading.loadIndex({
      book: 43,
      chapter: 15,
      resources: [
        { resourceId: 'acbc', language: 'fr' },
        { resourceId: 'barnes', language: 'fr' },
      ],
    })
    const sources: StudySource[] = await Promise.all(
      result.indexes.map(async (index, i) => {
        const section = index.sections.find(s => s.rangeStartVerse <= 4 && s.rangeEndVerse >= 4)
        if (!section) throw new Error('Section indisponible pour Jean 15:4.')
        const content = await resources.commentaryReading.loadSection({
          resourceId: index.resource.resourceId,
          language: 'fr',
          revision: index.resource.revision,
          book: 43,
          chapter: 15,
          sectionId: section.id,
        })
        return {
          id: `s${i + 1}`,
          kind: 'commentary',
          title: `${index.resource.resourceId === 'acbc' ? 'Adam Clarke' : 'Albert Barnes'} · Jean 15:4`,
          excerpt: excerpt(content.section.content),
          params: {
            resourceId: index.resource.resourceId,
            book: '43',
            chapter: '15',
            sectionId: section.id,
          },
        }
      })
    )
    return parseStudyWidget({ ...widget, sources })
  }
  if (widget.kind === 'dictionary_articles') {
    const sources: StudySource[] = await Promise.all(
      ['calmet', 'westphal'].map(async (work, i) => {
        const item = await resources.dictionary.loadItem('Patience', 'fr', work)
        if (!item?.id) throw new Error('Un dictionnaire de cet exemple est indisponible.')
        return {
          id: `s${i + 1}`,
          kind: 'dictionary',
          title: `Patience · ${work === 'calmet' ? 'Calmet' : 'Westphal'}`,
          excerpt: excerpt(item.definition),
          params: { work, entryId: String(item.id), word: item.word },
        }
      })
    )
    return parseStudyWidget({ ...widget, sources })
  }
  return parseStudyWidget(widget)
}

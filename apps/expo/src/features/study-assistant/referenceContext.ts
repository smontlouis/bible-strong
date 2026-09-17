import type { StrongLexiconEntity } from '~features/resources/strongLexiconAccess'
import type { TimelineEventDetail } from '~features/timeline/types'
import type { ReadingContext } from './conversations'
const bounded = (text: string) =>
  text.length > 12000
    ? text.slice(0, 11900) + '\n[Extrait tronqué ; la suite n’est pas fournie.]'
    : text
export function entityContext(
  entity: StrongLexiconEntity | undefined,
  language: string
): ReadingContext | null {
  if (!entity) return null
  return {
    kind:
      entity.category === 'place' ? 'place' : entity.category === 'person' ? 'person' : 'entity',
    key: `entity:${language}:${entity.uniqueName}`,
    label: entity.name.slice(0, 450),
    detail:
      `Fiche éditoriale ouverte : ${entity.name}; catégorie=${entity.category}; identifiant=${entity.uniqueName}; langue=${language}`.slice(
        0,
        500
      ),
    content: bounded(
      [
        entity.shortDescription,
        entity.description,
        entity.brief,
        entity.summaryHtml,
        entity.articleHtml,
        `Codes lexicaux : ${entity.strongCodes.join(', ')}`,
        ...entity.relations.map(
          r => `${r.relation} : ${r.targetName} (certitude : ${r.certainty})`
        ),
      ]
        .filter(Boolean)
        .join('\n\n')
    ),
  }
}
export function timelineContext(
  event: TimelineEventDetail | undefined,
  language: string
): ReadingContext | null {
  if (!event) return null
  return {
    kind: 'timeline',
    key: `timeline:${language}:${event.slug}`,
    label: event.title.slice(0, 450),
    detail:
      `Événement ouvert : ${event.title}; période=${event.period}; dates=${event.dates}; slug=${event.slug}; langue=${language}`.slice(
        0,
        500
      ),
    content: bounded(
      [event.description, event.article, `Références bibliques : ${event.scriptures.join(', ')}`]
        .filter(Boolean)
        .join('\n\n')
    ),
  }
}

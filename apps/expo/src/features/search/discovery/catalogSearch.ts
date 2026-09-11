import { COMMENTARY_CATALOG } from '@bible-strong/resource-catalog/commentaries'
import type { TimelineSection } from '~features/timeline/types'
import type { TabItem } from '~state/tabs'
import { matchesQuery } from '../shared/matchesQuery'

export type CatalogScope = 'commentary' | 'plan' | 'timeline'
export type DiscoveryScope = CatalogScope | 'passage'
type TabWithoutId<T> = T extends TabItem ? Omit<T, 'id'> : never

export type CatalogResult = {
  id: string
  title: string
  subtitle?: string
  type: CatalogScope
  tab: TabWithoutId<TabItem>
}

export function searchCommentaries(query: string, language: string): CatalogResult[] {
  return COMMENTARY_CATALOG.filter(entry =>
    matchesQuery(query, entry.title, entry.author, entry.shortName)
  ).flatMap(entry =>
    [...entry.languages]
      .sort((a, b) => Number(b === language) - Number(a === language))
      .map(lang => ({
        id: `commentary:${entry.id}:${lang}`,
        title: entry.title,
        subtitle: `${entry.author} · ${lang.toUpperCase()}`,
        type: 'commentary' as const,
        tab: {
          type: 'commentary-resource' as const,
          title: entry.shortName,
          isRemovable: true,
          data: { projectionId: `${entry.id}:${lang}`, book: 1, chapter: 1 },
        },
      }))
  )
}

export function searchTimeline(
  sections: TimelineSection[],
  query: string,
  language: string
): CatalogResult[] {
  const english = language.startsWith('en')
  return sections.flatMap((section, sectionIndex) => {
    const title = (english ? section.titleEn : section.title) || section.title
    const period: CatalogResult[] = matchesQuery(
      query,
      section.title,
      section.titleEn,
      section.sectionTitle,
      section.sectionTitleEn
    )
      ? [
          {
            id: `period:${section.id}`,
            type: 'timeline',
            title,
            subtitle: english ? 'Period' : 'Époque',
            tab: { type: 'timeline', title, isRemovable: true, data: { sectionIndex } },
          },
        ]
      : []
    const events: CatalogResult[] = query.trim()
      ? section.events
          .filter(event => matchesQuery(query, event.title, event.titleEn))
          .map(event => ({
            id: `event:${section.id}:${event.id}`,
            type: 'timeline',
            title: (english ? event.titleEn : event.title) || event.title,
            subtitle: `${english ? 'Event' : 'Événement'} · ${title}`,
            tab: {
              type: 'timeline',
              title: (english ? event.titleEn : event.title) || event.title,
              isRemovable: true,
              data: { sectionIndex, eventSlug: event.slug, event: { ...event, sectionIndex } },
            },
          }))
      : []
    return [...period, ...events]
  })
}

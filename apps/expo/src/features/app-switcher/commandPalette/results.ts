import { matchesQuery } from '~features/search/shared/matchesQuery'
import { parseBibleReferenceInput } from '~helpers/bcvParser'
import type { BcvLanguage } from '~helpers/bcvParser'
import type { TabGroup } from '~state/tabs'

export { matchesQuery } from '~features/search/shared/matchesQuery'

export const destinations = [
  {
    type: 'bible',
    key: 'Bible',
    aliases: 'bible scripture lecture lire read passage verset verse reference',
  },
  { type: 'notes', key: 'tabs.notes', aliases: 'notes note' },
  { type: 'study', key: 'Études', aliases: 'etudes etude studies study' },
  { type: 'compare', key: 'tabs.compare', aliases: 'comparer comparaison compare parallel' },
  {
    type: 'plan',
    key: 'Plans & Méditations',
    aliases: 'plans lecture reading meditation meditations recueil devotional',
  },
  { type: 'timeline', key: 'tabs.timeline', aliases: 'chronologie timeline histoire' },
  { type: 'strong', key: 'tabs.strong', aliases: 'strong lexique lexicon grec hebreu' },
  { type: 'dictionary', key: 'tabs.dictionary', aliases: 'dictionnaire dictionary' },
  { type: 'nave', key: 'tabs.nave', aliases: 'nave themes topics' },
  { type: 'commentary', key: 'tabs.commentary', aliases: 'commentaires commentary' },
] as const

export function findPassages(query: string, language: BcvLanguage) {
  const parsed = parseBibleReferenceInput(query, language)
  return parsed.isExact ? parsed.references : []
}

export function findTabs(groups: TabGroup[], query: string, recentIds: string[]) {
  return groups
    .flatMap(group =>
      group.tabs
        .filter(tab => tab.type !== 'new')
        .map(tab => ({
          tab,
          groupId: group.id,
          groupName: group.name,
          isDefaultGroup: group.isDefault,
          groupColor: group.color,
          version: tab.type === 'bible' ? tab.data.selectedVersion : '',
        }))
    )
    .filter(item => matchesQuery(query, item.tab.title, item.groupName, item.version))
    .sort((a, b) => {
      const rank = (id: string) =>
        recentIds.includes(id) ? recentIds.indexOf(id) : recentIds.length
      return rank(a.tab.id) - rank(b.tab.id)
    })
    .slice(0, query.trim() ? 12 : 5)
}

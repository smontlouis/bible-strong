import {
  COMMENTARY_CATALOG,
  type CommentaryCatalogEntry,
} from '@bible-strong/resource-catalog/commentaries'

export const COMMENTARY_TRADITIONS = [
  ...new Set(COMMENTARY_CATALOG.map(entry => entry.tradition)),
].sort((left, right) => left.localeCompare(right, 'fr'))

export const COMMENTARY_CURRENTS = [
  ...new Set(COMMENTARY_CATALOG.flatMap(entry => [...entry.tags])),
].sort((left, right) => left.localeCompare(right, 'fr'))

export const matchesCommentaryTaxonomyFilters = (
  entry: CommentaryCatalogEntry,
  traditions: readonly string[],
  currents: readonly string[]
) => {
  const matchesTradition = traditions.length === 0 || traditions.includes(entry.tradition)
  const matchesCurrent =
    currents.length === 0 || currents.some(current => entry.tags.includes(current))
  return matchesTradition && matchesCurrent
}

export const toggleCommentaryTaxonomyFilter = (
  selected: readonly string[],
  value: string
): string[] =>
  selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]

const TAXONOMY_LABEL_KEYS: Record<string, string> = {
  Protestantisme: 'protestantism',
  Catholicisme: 'catholicism',
  'Christianisme ancien': 'earlyChristianity',
  Judaïsme: 'judaism',
  Adventiste: 'adventist',
  Anglican: 'anglican',
  Arminien: 'arminian',
  Baptiste: 'baptist',
  Calviniste: 'calvinist',
  Catholique: 'catholic',
  Congrégationaliste: 'congregationalist',
  Dispensationaliste: 'dispensationalist',
  Évangélique: 'evangelical',
  Frères: 'brethren',
  Luthérien: 'lutheran',
  Méthodiste: 'methodist',
  Patristique: 'patristic',
  'Patristique occidentale': 'westernPatristic',
  'Patristique orientale': 'easternPatristic',
  Presbytérien: 'presbyterian',
  Puritain: 'puritan',
  Rabbinique: 'rabbinic',
  Réformé: 'reformed',
  'Réformé francophone': 'francophoneReformed',
  Restaurationniste: 'restorationist',
  Scolastique: 'scholastic',
  Thomiste: 'thomist',
  Wesleyen: 'wesleyan',
}

export const getCommentaryTaxonomyLabelKey = (value: string) =>
  `commentaries.taxonomy.${TAXONOMY_LABEL_KEYS[value] ?? value}`

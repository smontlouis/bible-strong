import type { UnifiedDownloadItem } from '../downloadBibleItems'
import {
  buildDownloadResourceSections,
  flattenDownloadSubsections,
} from '../downloadResourceSections'

const item = (id: string, lang: UnifiedDownloadItem['lang']): UnifiedDownloadItem => ({
  id,
  name: id,
  estimatedSize: 1,
  lang,
  searchText: id,
})

const titles = {
  french: 'Français',
  english: 'English',
  original: 'Langues originales',
  bibles: 'Bibles',
  commentaries: 'Commentaires',
  dictionaries: 'Dictionnaires',
  studyTools: "Outils d'étude",
  otherResources: 'Autres ressources',
}

describe('download resource sections', () => {
  it('keeps localized lexicons in their language section alongside shared tools', () => {
    const empty = { bibles: [], commentaries: [], dictionaries: [], otherResources: [] }
    const sections = buildDownloadResourceSections({
      titles,
      french: { ...empty, studyTools: [item('strong-lexicon:simple-fr', 'fr')] },
      english: { ...empty, studyTools: [item('strong-lexicon:simple-en', 'en')] },
      originalBibles: [],
      sharedStudyTools: [item('strong-lexicon:core', 'other')],
    })
    expect(flattenDownloadSubsections('fr', sections[0].subsections).map(row => row.id)).toEqual([
      'strong-lexicon:simple-fr',
      'strong-lexicon:core',
    ])
    expect(flattenDownloadSubsections('en', sections[1].subsections).map(row => row.id)).toEqual([
      'strong-lexicon:simple-en',
      'strong-lexicon:core',
    ])
  })

  it('shows shared resources in French and English with one resource identity', () => {
    const sharedCrossReferences = item('database:TRESOR:fr', 'fr')
    const sections = buildDownloadResourceSections({
      titles,
      french: {
        bibles: [item('bible:LSG', 'fr')],
        commentaries: [],
        dictionaries: [],
        otherResources: [],
      },
      english: {
        bibles: [item('bible:KJV', 'en')],
        commentaries: [],
        dictionaries: [],
        otherResources: [],
      },
      originalBibles: [],
      sharedStudyTools: [sharedCrossReferences],
    })

    const frenchShared = sections[0].subsections.find(({ key }) => key === 'study-tools')!
    const englishShared = sections[1].subsections.find(({ key }) => key === 'study-tools')!
    const frenchRow = flattenDownloadSubsections('fr', [frenchShared])[0]
    const englishRow = flattenDownloadSubsections('en', [englishShared])[0]

    expect(frenchRow.id).toBe(englishRow.id)
    expect(frenchRow.occurrenceKey).not.toBe(englishRow.occurrenceKey)
  })

  it('marks the first visible item of each subsection', () => {
    const rows = flattenDownloadSubsections('fr', [
      { key: 'bibles', title: 'Bibles', data: [item('one', 'fr'), item('two', 'fr')] },
      { key: 'tools', title: 'Outils', data: [item('three', 'fr')] },
    ])

    expect(rows.map(row => row.startsSubsection)).toEqual([true, false, true])
  })
})

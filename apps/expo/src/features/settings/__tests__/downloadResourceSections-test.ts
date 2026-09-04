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

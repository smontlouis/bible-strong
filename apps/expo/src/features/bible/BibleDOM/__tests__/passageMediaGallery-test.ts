import type { ResolvedPassageMedia } from '../../passageMedia'
import { getPassageMediaGalleryItems, getPassageMediaGallerySections } from '../passageMediaGallery'

const media = (editionId: string): ResolvedPassageMedia => ({
  workId: editionId,
  editionId,
  attributionLabel: 'BibleProject',
  reference: `Référence ${editionId}`,
  strongCodes: [],
  provider: 'youtube',
  providerId: editionId,
  sourceUrl: `https://youtube.test/${editionId}`,
  thumbnailUrl: `https://img.test/${editionId}.jpg`,
  blurHash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
  title: editionId,
  durationSeconds: 60,
})

describe('getPassageMediaGallerySections', () => {
  it('groups chapter resources before passage media and replaces attribution with references', () => {
    const introduction = media('introduction')
    const passage = media('passage')
    const chapterResource = media('chapter-resource')

    expect(
      getPassageMediaGallerySections({
        passageMedia: {
          introduction: [introduction],
          isIntroductionStartChapter: true,
          afterVerses: { 3: [passage], 5: [passage] },
          chapterResources: [chapterResource],
        },
        sectionTitles: {
          introduction: 'Introduction',
          passages: 'Passages bibliques',
          chapterResources: 'Ressources du chapitre',
        },
      })
    ).toEqual([
      {
        id: 'chapter-resources',
        title: 'Ressources du chapitre',
        items: [chapterResource],
      },
      {
        id: 'passages',
        title: 'Passages bibliques',
        items: [passage],
      },
    ])
  })

  it('exposes passage media in the final chapter stack when there are no chapter resources', () => {
    const passage = media('agape')
    const sections = getPassageMediaGallerySections({
      passageMedia: {
        introduction: [],
        isIntroductionStartChapter: false,
        afterVerses: { 7: [passage] },
        chapterResources: [],
      },
      sectionTitles: {
        introduction: 'Introduction',
        passages: 'Passages bibliques',
        chapterResources: 'Ressources du chapitre',
      },
    })

    expect(getPassageMediaGalleryItems(sections)).toEqual([
      expect.objectContaining({ editionId: 'agape' }),
    ])
  })
})

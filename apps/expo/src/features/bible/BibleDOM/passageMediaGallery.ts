import type { ResolvedPassageMedia, ResolvedPassageMediaChapter } from '../passageMedia'

export type PassageMediaGalleryItem = ResolvedPassageMedia

export type PassageMediaGallerySection = {
  id: 'introduction' | 'passages' | 'chapter-resources'
  title: string
  items: PassageMediaGalleryItem[]
}

const getPassageItems = (
  afterVerses: ResolvedPassageMediaChapter['afterVerses']
): PassageMediaGalleryItem[] => {
  const itemsByEdition = new Map<string, ResolvedPassageMedia>()

  Object.entries(afterVerses)
    .sort(([left], [right]) => Number(left) - Number(right))
    .forEach(([, items]) => {
      items.forEach(item => {
        if (!itemsByEdition.has(item.editionId)) itemsByEdition.set(item.editionId, item)
      })
    })

  return Array.from(itemsByEdition.values())
}

type GetPassageMediaGallerySectionsInput = {
  passageMedia: ResolvedPassageMediaChapter
  sectionTitles: {
    introduction: string
    passages: string
    chapterResources: string
  }
}

export const getPassageMediaGallerySections = ({
  passageMedia,
  sectionTitles,
}: GetPassageMediaGallerySectionsInput): PassageMediaGallerySection[] => {
  return (
    [
      {
        id: 'chapter-resources',
        title: sectionTitles.chapterResources,
        items: passageMedia.chapterResources,
      },
      {
        id: 'passages',
        title: sectionTitles.passages,
        items: getPassageItems(passageMedia.afterVerses),
      },
    ] satisfies PassageMediaGallerySection[]
  ).filter(section => section.items.length > 0)
}

export const getPassageMediaGalleryItems = (
  sections: PassageMediaGallerySection[]
): ResolvedPassageMedia[] => {
  const itemsByEdition = new Map<string, ResolvedPassageMedia>()

  sections.forEach(section => {
    section.items.forEach(item => {
      if (!itemsByEdition.has(item.editionId)) itemsByEdition.set(item.editionId, item)
    })
  })

  return Array.from(itemsByEdition.values())
}

import type { ResolvedPassageMedia, ResolvedPassageMediaChapter } from '../passageMedia'

export type PassageMediaGalleryItem = ResolvedPassageMedia & {
  reference: string
}

export type PassageMediaGallerySection = {
  id: 'introduction' | 'passages' | 'chapter-resources'
  title: string
  items: PassageMediaGalleryItem[]
}

const getChapterReference = (bookName: string, chapter: number) => `${bookName} ${chapter}`

const getPassageItems = (
  afterVerses: ResolvedPassageMediaChapter['afterVerses'],
  bookName: string,
  chapter: number
): PassageMediaGalleryItem[] => {
  const itemsByEdition = new Map<string, { item: ResolvedPassageMedia; verseNumbers: number[] }>()

  Object.entries(afterVerses)
    .sort(([left], [right]) => Number(left) - Number(right))
    .forEach(([verseNumber, items]) => {
      items.forEach(item => {
        const existing = itemsByEdition.get(item.editionId)
        if (existing) {
          existing.verseNumbers.push(Number(verseNumber))
          return
        }

        itemsByEdition.set(item.editionId, {
          item,
          verseNumbers: [Number(verseNumber)],
        })
      })
    })

  return Array.from(itemsByEdition.values()).map(({ item, verseNumbers }) => ({
    ...item,
    reference: `${getChapterReference(bookName, chapter)}:${verseNumbers.join(', ')}`,
  }))
}

type GetPassageMediaGallerySectionsInput = {
  passageMedia: ResolvedPassageMediaChapter
  bookName: string
  chapter: number
  sectionTitles: {
    introduction: string
    passages: string
    chapterResources: string
  }
}

export const getPassageMediaGallerySections = ({
  passageMedia,
  bookName,
  chapter,
  sectionTitles,
}: GetPassageMediaGallerySectionsInput): PassageMediaGallerySection[] => {
  const chapterReference = getChapterReference(bookName, chapter)

  return (
    [
      {
        id: 'chapter-resources',
        title: sectionTitles.chapterResources,
        items: passageMedia.chapterResources.map(item => ({
          ...item,
          reference: chapterReference,
        })),
      },
      {
        id: 'passages',
        title: sectionTitles.passages,
        items: getPassageItems(passageMedia.afterVerses, bookName, chapter),
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

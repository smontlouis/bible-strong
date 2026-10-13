import type { EntitySlice } from '~common/types'

type Route = { pathname: string; params: Record<string, string> }

const range = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index)

/** "1|4-5" is Genesis 4 to 5; the reader opens on the first chapter and stays within them. */
const getChaptersRoute = (chapters: string): Route | undefined => {
  const match = /^(\d+)\|(\d+)(?:-(\d+))?$/.exec(chapters)
  if (!match) return undefined
  const [, book, start, end = start] = match
  if (Number(end) < Number(start)) return undefined

  return { pathname: '/bible-view', params: { book, chapter: start, planEndChapter: end } }
}

/** "13|1:1-4" is 1 Chronicles 1:1-4; the reader opens focused on these verses. */
const getVersesRoute = (verses: string): Route | undefined => {
  const match = /^(\d+)\|(\d+):(\d+)(?:-(\d+))?$/.exec(verses)
  if (!match) return undefined
  const [, book, chapter, start, end = start] = match
  if (Number(end) < Number(start)) return undefined

  return {
    pathname: '/bible-view',
    params: {
      book,
      chapter,
      verse: start,
      focusVerses: JSON.stringify(range(Number(start), Number(end))),
      contextDisplayMode: 'focused',
      planEndChapter: chapter,
    },
  }
}

/** A passage opens the Bible reader in plan mode; a text, an image or a video has its own page. */
export const getPlanEntityRoute = ({
  planId,
  readingSliceId,
  entitySliceId,
  slice,
}: {
  planId: string
  readingSliceId: string
  entitySliceId: string
  slice: EntitySlice
}): Route | undefined => {
  switch (slice.type) {
    case 'Chapter':
      return getChaptersRoute(slice.chapters)
    case 'Verse':
      return getVersesRoute(slice.verses)
    case 'Text':
    case 'Image':
    case 'Video':
      return { pathname: '/plan-entity', params: { planId, readingSliceId, entitySliceId } }
    default:
      return undefined
  }
}

import { useQuery } from '@tanstack/react-query'
import i18n from '~i18n'
import { remoteQueryOptions } from '~helpers/queryOptions'

interface ImageUrls {
  small?: string
  large?: string
  error?: boolean
}

interface VerseOfTheDay {
  v?: string
  error?: boolean
}

export const useImageUrls = (verseOfTheDay: VerseOfTheDay | false): ImageUrls | null => {
  const verseId = verseOfTheDay && 'v' in verseOfTheDay ? verseOfTheDay.v : undefined
  const query = useQuery({
    queryKey: ['verse-image-urls', verseId, i18n.language],
    queryFn: async () => {
      const imageRes = await fetch(
        `https://nodejs.bible.com/api/images/items/3.1?page=1&category=prerendered&usfm%5B0%5D=${verseId}&language_tag=${i18n.language}`
      )
      if (!imageRes.ok) throw new Error(`Verse image request failed (${imageRes.status})`)
      const imageJSON = await imageRes.json()
      const image = imageJSON.images.at(-1)
      if (!image) throw new Error('Verse image response is empty')
      return {
        small: `https:${image.renditions[0].url}`,
        large: `https:${image.renditions[2].url}`,
      }
    },
    enabled: !!verseId,
    ...remoteQueryOptions,
  })

  return query.isError || query.fetchStatus === 'paused' ? { error: true } : (query.data ?? null)
}

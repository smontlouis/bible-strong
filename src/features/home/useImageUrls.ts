import { useState, useEffect } from 'react'
import i18n from '~i18n'

interface ImageUrls {
  small?: string
  large?: string
  error?: boolean
}

interface VerseOfTheDay {
  v: string
}

export const useImageUrls = (verseOfTheDay: VerseOfTheDay): ImageUrls | null => {
  const [imageUrls, setImageUrls] = useState<ImageUrls | null>(null)
  useEffect(() => {
    const loadImageUrls = async () => {
      try {
        const imageRes = await fetch(
          `https://nodejs.bible.com/api/images/items/3.1?page=1&category=prerendered&usfm%5B0%5D=${verseOfTheDay.v}&language_tag=${i18n.language}`
        )
        const imageJSON = await imageRes.json()
        setImageUrls({
          small: `https:${imageJSON.images[imageJSON.images.length - 1].renditions[0].url}`,
          large: `https:${imageJSON.images[imageJSON.images.length - 1].renditions[2].url}`,
        })
      } catch {
        setImageUrls({
          error: true,
        })
      }
    }
    if (verseOfTheDay.v) {
      loadImageUrls()
    }
  }, [verseOfTheDay.v])
  return imageUrls
}

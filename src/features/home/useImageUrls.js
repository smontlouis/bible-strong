import { useState, useEffect } from 'react'

export const useImageUrls = verseOfTheDay => {
  const [imageUrls, setImageUrls] = useState(null)
  useEffect(() => {
    const loadImageUrls = async () => {
      try {
        const imageRes = await fetch(
          `https://nodejs.bible.com/api/images/items/3.1?page=1&category=prerendered&usfm%5B0%5D=${verseOfTheDay.v}&language_tag=fr`
        )
        const imageJSON = await imageRes.json()
        setImageUrls({
          small: `https:${
            imageJSON.images[imageJSON.images.length - 1].renditions[0].url
          }`,
          large: `https:${
            imageJSON.images[imageJSON.images.length - 1].renditions[2].url
          }`,
        })
      } catch (e) {
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

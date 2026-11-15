// What a card drawn with Skia needs before it shows (ADR-0090): the app's font and the card's two
// pictures. Skia keeps no cache of its own, so they are kept here: the font for the whole run of the
// app, the last pictures for a card opened again (the header, then the album).

import { Skia, type SkImage, type SkTypefaceFontProvider } from '@shopify/react-native-skia'
import { useEffect, useState } from 'react'
import { Image } from 'react-native'

import { LITERATA } from './cardParagraphs'

let fontProvider: SkTypefaceFontProvider | undefined
let fontLoading: Promise<SkTypefaceFontProvider | undefined> | undefined

/** Loads the lettering's font once; later cards set their text at once. */
export const loadCardFonts = () => {
  fontLoading ??= Skia.Data.fromURI(
    Image.resolveAssetSource(require('~assets/fonts/LiterataBook-Regular.otf')).uri
  )
    .then(data => {
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data)
      if (!typeface) return undefined
      const provider = Skia.TypefaceFontProvider.Make()
      provider.registerFont(typeface, LITERATA)
      fontProvider = provider
      return provider
    })
    .catch(() => {
      fontLoading = undefined
      return undefined
    })
  return fontLoading
}

export const useCardFonts = () => {
  const [loaded, setLoaded] = useState(fontProvider)
  useEffect(() => {
    if (fontProvider) return
    let live = true
    void loadCardFonts().then(provider => {
      if (live && provider) setLoaded(provider)
    })
    return () => {
      live = false
    }
  }, [])
  return fontProvider ?? loaded ?? null
}

/** The pictures kept, newest last; a card has two. */
const KEPT_PICTURES = 12
const pictures = new Map<string, SkImage | null>()
const loadingPictures = new Map<string, Promise<SkImage | null>>()

/** Loads a card's picture; null when it cannot be had (offline, missing), so the card still shows. */
export const loadCardPicture = (uri: string) => {
  if (pictures.has(uri)) return Promise.resolve(pictures.get(uri) ?? null)
  const loading =
    loadingPictures.get(uri) ??
    Skia.Data.fromURI(uri)
      .then(data => Skia.Image.MakeImageFromEncoded(data))
      .catch(() => null)
      .then(image => {
        loadingPictures.delete(uri)
        pictures.set(uri, image)
        while (pictures.size > KEPT_PICTURES) {
          const oldest = pictures.keys().next().value
          if (oldest === undefined) break
          pictures.delete(oldest)
        }
        return image
      })
  loadingPictures.set(uri, loading)
  return loading
}

/** A card's picture and whether its loading is over, a failure included. */
export const useCardPicture = (uri: string | null | undefined) => {
  const [loaded, setLoaded] = useState<{ uri: string; image: SkImage | null }>()
  useEffect(() => {
    if (!uri || pictures.has(uri)) return
    let live = true
    void loadCardPicture(uri).then(image => {
      if (live) setLoaded({ uri, image })
    })
    return () => {
      live = false
    }
  }, [uri])
  if (!uri) return { image: null, settled: true }
  if (pictures.has(uri)) return { image: pictures.get(uri) ?? null, settled: true }
  if (loaded?.uri === uri) return { image: loaded.image, settled: true }
  return { image: null, settled: false }
}

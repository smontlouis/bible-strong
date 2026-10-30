import type { ResourceLanguage } from '../resources/publicSite'
import type { AtlasCardPageData, AtlasCardsPageData } from './atlas.functions'

// The gallery a browser holds, so that opening a card, or coming back to the gallery, asks the
// server for nothing. The server keeps nothing here: a Worker serves many readers.
const galleries = new Map<ResourceLanguage, AtlasCardsPageData>()

export const rememberCardsPage = (page: AtlasCardsPageData) => {
  if (typeof window !== 'undefined' && !page.incomplete) galleries.set(page.language, page)
}

export const rememberedCardsPage = (language: ResourceLanguage) =>
  typeof window === 'undefined' ? undefined : galleries.get(language)

export const rememberedCardPage = (
  language: ResourceLanguage,
  id: string
): AtlasCardPageData | undefined => {
  const card = rememberedCardsPage(language)?.cards.find(item => item.id === id)
  return card ? { language, card, incomplete: false } : undefined
}

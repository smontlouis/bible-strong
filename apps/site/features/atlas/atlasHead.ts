import { absoluteSiteUrl, RESOURCE_LANGUAGES } from '../resources/publicSite'
import { buildResourceHead } from '../resources/resourceHead'
import { SHARE_MAP_SIZE, shareMapPixel, shareMapWindow } from '../share/shareCardMap'
import { shareCardExcerpt, shareCardLine } from '../share/shareCardText'
import { CARD_FAMILY_LABELS, type AtlasGalleryCard } from './atlasCardCatalog'
import type {
  AtlasCardPageData,
  AtlasCardsPageData,
  AtlasEntityPageData,
  AtlasFamilyPageData,
  AtlasHomePageData,
  AtlasMapPoint,
  AtlasTile,
} from './atlas.functions'
import { entitySharePicture } from './atlasPortraits'
import {
  buildAtlasCardPath,
  buildAtlasCardsPath,
  buildAtlasEntityPath,
  buildAtlasFamilyPath,
  buildAtlasPath,
} from './atlasRoutes'
import { ATLAS_MESSAGES, countLabel } from './messages'

const DESCRIPTION_LENGTH = 155

export const cut = (text: string, length: number) => {
  const line = shareCardLine(text)
  if (line.length <= length) return line
  let head = line.slice(0, length)
  head = head.slice(0, Math.max(head.lastIndexOf(' '), length * 0.6))
  // A parenthesis left open, a reference most often, is dropped whole.
  const open = head.lastIndexOf('(')
  if (open > head.lastIndexOf(')') && open > length * 0.5) head = head.slice(0, open)
  return `${head.replace(/[\s,;:.–—-]+$/u, '')}…`
}

/**
 * A line on an entity that opens on its name (« Israël, le père des douze tribus ») without that
 * name, which its title already says; `undefined` when it does not open on it.
 */
export const afterName = (text: string, name: string): string | undefined => {
  const rest = text.startsWith(name) ? text.slice(name.length) : undefined
  const match = rest === undefined ? null : /^\s*[,:–—-]\s*(\S.*)$/u.exec(rest)
  return match ? match[1].charAt(0).toLocaleUpperCase() + match[1].slice(1) : undefined
}

/** Six painted entities, the most named first, for a page that stands for many. */
const gallery = (tiles: AtlasTile[]) => {
  const painted = [
    ...new Map(tiles.filter(tile => tile.painted).map(tile => [tile.uniqueName, tile])).values(),
  ]
    .sort((a, b) => b.chapterCount - a.chapterCount)
    .slice(0, 6)
  return painted.length === 6
    ? {
        pictures: painted.map(tile => ({
          src: entitySharePicture(tile.picture),
          caption: tile.name,
        })),
        cutOut: true,
      }
    : {}
}

type Box = { left: number; top: number; right: number; bottom: number }
const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

// The width a name takes on the map of a card, at its size, a little generously.
const nameWidth = (name: string, size: number) => name.length * size * 0.56

/**
 * The places named around a place on its card: the most named first, as many as fit inside the
 * map without covering the place, its name or one another.
 */
export const shareMapNeighbours = (
  point: AtlasMapPoint,
  neighbours: AtlasMapPoint[],
  name: string
): [name: string, x: number, y: number][] => {
  const window = shareMapWindow(point[2], point[3])
  const self = shareMapPixel(window, point[2], point[3])
  const taken: Box[] = [
    { left: self.left - 16, top: self.top - 16, right: self.left + 16, bottom: self.top + 16 },
    {
      left: self.left + 18,
      top: self.top - 22,
      right: self.left + 26 + nameWidth(name, 26),
      bottom: self.top + 16,
    },
  ]
  const named: [string, number, number][] = []
  for (const other of [...neighbours].sort((a, b) => b[4] - a[4])) {
    if (named.length === 5) break
    const at = shareMapPixel(window, other[2], other[3])
    const box = {
      left: at.left - 8,
      top: at.top - 16,
      right: at.left + 14 + nameWidth(other[0], 19),
      bottom: at.top + 14,
    }
    if (
      box.left < 6 ||
      box.top < 6 ||
      box.right > SHARE_MAP_SIZE - 6 ||
      box.bottom > SHARE_MAP_SIZE - 6
    )
      continue
    if (taken.some(other => overlaps(other, box))) continue
    taken.push(box)
    named.push([other[0], Math.round(other[2] * 10) / 10, Math.round(other[3] * 10) / 10])
  }
  return named
}

/** Every page of the atlas exists in both languages: each lists the other. */
const bothLanguages = (pathFor: (language: 'fr' | 'en') => string) =>
  Object.fromEntries(RESOURCE_LANGUAGES.map(language => [language, pathFor(language)]))

export const buildAtlasHomeHead = (page: AtlasHomePageData) => {
  const { language } = page
  const messages = ATLAS_MESSAGES[language]
  const path = buildAtlasPath(language)
  const description = messages.homeHeadDescription.replace(
    '{entities}',
    page.entityCount.toLocaleString(language)
  )
  return buildResourceHead({
    title: messages.homeHeadTitle,
    description,
    path,
    language,
    alternates: bothLanguages(buildAtlasPath),
    ogType: 'website',
    shareCard: {
      kind: 'title',
      title: messages.homeTitle,
      facts: ATLAS_MESSAGES[language].count.replace(
        '{count}',
        page.entityCount.toLocaleString(language)
      ),
      ...gallery(page.series.flatMap(series => series.members)),
      excerpt: shareCardExcerpt(
        messages.homeLead.replace('{entities}', page.entityCount.toLocaleString(language)),
        gallery(page.series.flatMap(series => series.members)).pictures !== undefined
      ),
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: messages.name,
        description,
        inLanguage: language,
      },
    ],
  })
}

export const buildAtlasFamilyHead = (page: AtlasFamilyPageData) => {
  const { language, family } = page
  const messages = ATLAS_MESSAGES[language]
  const name = messages.families[family]
  const path = buildAtlasFamilyPath(language, family)
  const description = messages.familyHeadDescriptions[family].replace(
    '{count}',
    page.count.toLocaleString(language)
  )
  return buildResourceHead({
    title: messages.familyHeadTitle.replace('{family}', name),
    description,
    path,
    language,
    alternates: bothLanguages(other => buildAtlasFamilyPath(other, family)),
    ogType: 'website',
    breadcrumbs: [{ label: messages.name, path: buildAtlasPath(language) }, { label: name }],
    shareCard: {
      kind: 'title',
      kicker: messages.name,
      title: name,
      facts: messages.count.replace('{count}', page.count.toLocaleString(language)),
      ...gallery(page.painted),
      excerpt: shareCardExcerpt(
        messages.familyLeads[family],
        gallery(page.painted).pictures !== undefined
      ),
    },
  })
}

export const buildAtlasEntityHead = (page: AtlasEntityPageData) => {
  const { language, uniqueName } = page
  const messages = ATLAS_MESSAGES[language]
  const path = buildAtlasEntityPath(language, uniqueName)
  const brief = page.title ?? page.brief
  const briefAfterName = brief ? afterName(brief, page.name) : undefined
  const opening = page.paragraphs[0]
  const description = cut(
    opening ?? messages.entityFallbackDescription.replace('{name}', page.name),
    DESCRIPTION_LENGTH
  )
  const facts =
    page.chapterCount > 0 ? countLabel(messages.chapters, page.chapterCount, language) : undefined
  return buildResourceHead({
    title: briefAfterName
      ? messages.entityHeadTitleNamed.replace('{brief}', brief)
      : brief
        ? messages.entityHeadTitle.replace('{name}', page.name).replace('{brief}', brief)
        : messages.entityHeadTitlePlain.replace('{name}', page.name),
    description,
    path,
    language,
    alternates: bothLanguages(other => buildAtlasEntityPath(other, uniqueName)),
    breadcrumbs: [
      { label: messages.name, path: buildAtlasPath(language) },
      { label: messages.families[page.family], path: buildAtlasFamilyPath(language, page.family) },
      { label: page.name },
    ],
    shareCard: {
      kind: 'entity',
      kicker: messages.name,
      chip: messages.families[page.family],
      title: page.name,
      ...(facts ? { facts } : {}),
      ...(brief || opening
        ? { excerpt: shareCardExcerpt(briefAfterName ?? (brief || opening), true) }
        : {}),
      // A painted entity shows its picture; a place that is not, where it lies; the others
      // their clay figure.
      ...(!page.painted && page.point
        ? {
            map: {
              x: Math.round(page.point[2] * 10) / 10,
              y: Math.round(page.point[3] * 10) / 10,
              neighbours: shareMapNeighbours(page.point, page.neighbours, page.name),
            },
          }
        : { picture: entitySharePicture(page.picture) }),
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: page.name,
        description,
        inLanguage: language,
        ...(page.painted ? { image: page.picture } : {}),
      },
    ],
  })
}

/** A card's sentence with its reference, or the sentence alone, cut, where both do not fit. */
const cardShareLine = (card: AtlasGalleryCard, language: 'fr' | 'en') => {
  const quote = (text: string) => (language === 'fr' ? `« ${text} »` : `“${text}”`)
  const whole = `${quote(card.sentence)} ${card.source}`
  return whole.length <= 92 ? whole : quote(shareCardExcerpt(card.sentence, true))
}

/** The cut-out PNG of a card's picture, which a share image can draw; a whole scene keeps its own. */
const cardSharePicture = (card: AtlasGalleryCard) => entitySharePicture(card.picture)

export const buildAtlasCardsHead = (page: AtlasCardsPageData) => {
  const { language } = page
  const messages = ATLAS_MESSAGES[language]
  const path = buildAtlasCardsPath(language)
  const count = page.cards.length.toLocaleString(language)
  const description = messages.cardsHeadDescription.replace('{cards}', count)
  // Six cards of different characters, the most named first, as the other pages show theirs.
  const shown = [...new Map(page.cards.map(card => [card.entity, card])).values()]
    .filter(card => !card.scene)
    .sort((left, right) => right.chapterCount - left.chapterCount)
    .slice(0, 6)
  return buildResourceHead({
    title: messages.cardsHeadTitle,
    description,
    path,
    language,
    alternates: bothLanguages(buildAtlasCardsPath),
    ogType: 'website',
    breadcrumbs: [
      { label: messages.name, path: buildAtlasPath(language) },
      { label: messages.cardsTitle },
    ],
    shareCard: {
      kind: 'title',
      kicker: messages.name,
      title: messages.cardsTitle,
      facts: countLabel(messages.cardsCount, page.cards.length, language),
      ...(shown.length === 6
        ? {
            pictures: shown.map(card => ({ src: cardSharePicture(card), caption: card.name })),
            cutOut: true,
          }
        : {}),
      excerpt: shareCardExcerpt(messages.cardsLead.replace('{cards}', count), shown.length === 6),
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: messages.cardsTitle,
        description,
        inLanguage: language,
      },
    ],
  })
}

/**
 * A card opened over the gallery: a page of its own to share, which only rearranges the gallery
 * and the character's page, so it is not indexed.
 */
export const buildAtlasCardHead = (page: AtlasCardPageData) => {
  const { language, card } = page
  const messages = ATLAS_MESSAGES[language]
  const path = buildAtlasCardPath(language, card.id)
  const description = cut(
    messages.cardHeadDescription
      .replace('{name}', card.name)
      .replace('{title}', card.title)
      .replace('{sentence}', card.sentence)
      .replace('{source}', card.source)
      .replace('{brief}', card.brief.replace(/[.\s]+$/u, '')),
    DESCRIPTION_LENGTH
  )
  return buildResourceHead({
    title: messages.cardHeadTitle.replace('{name}', card.name).replace('{title}', card.title),
    description,
    path,
    language,
    alternates: bothLanguages(other => buildAtlasCardPath(other, card.id)),
    indexable: false,
    breadcrumbs: [
      { label: messages.name, path: buildAtlasPath(language) },
      { label: messages.cardsTitle, path: buildAtlasCardsPath(language) },
      { label: card.name },
    ],
    shareCard: {
      kind: 'entity',
      kicker: messages.cardsName,
      chip: CARD_FAMILY_LABELS[card.family][language],
      title: card.name,
      facts: card.title,
      excerpt: cardShareLine(card, language),
      picture: cardSharePicture(card),
    },
  })
}

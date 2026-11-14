import {
  FontSlant,
  Skia,
  TextAlign,
  TextDirection,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia'

import { CARD_FAMILY_LABELS, CARD_WORDS, type EntityCardView } from './cardCatalog'
import type { CardPalette } from './cardPalettes'

// The lettering of both faces, set once per card and size. Sizes are in hundredths of the card's
// width, as the atlas's `cqw`.

export const LITERATA = 'Literata Book'
const MONO = ['Menlo', 'Courier']
const HEBREW = ['Times New Roman', 'Arial Hebrew']
const GREEK = [LITERATA, 'Georgia']

type Style = {
  size: number
  color: string
  align?: TextAlign
  italic?: boolean
  weight?: number
  letterSpacing?: number
  height?: number
  maxLines?: number
  shadow?: number
  families?: string[]
  direction?: TextDirection
}

const makeSetter = (fonts: SkTypefaceFontProvider) => {
  /** A paragraph in Literata, or in a family of the system when `families` names one. */
  return (text: string, style: Style, width: number): SkParagraph => {
    const system = !!style.families && style.families[0] !== LITERATA
    const paragraphStyle = {
      textAlign: style.align ?? TextAlign.Left,
      textDirection: style.direction ?? TextDirection.LTR,
      maxLines: style.maxLines,
      ellipsis: style.maxLines ? '…' : undefined,
    }
    const builder = system
      ? Skia.ParagraphBuilder.Make(paragraphStyle)
      : Skia.ParagraphBuilder.Make(paragraphStyle, fonts)
    builder.pushStyle({
      color: Skia.Color(style.color),
      fontFamilies: style.families ?? [LITERATA],
      fontSize: style.size,
      fontStyle: {
        weight: style.weight ?? 400,
        slant: style.italic ? FontSlant.Italic : FontSlant.Upright,
      },
      letterSpacing: style.letterSpacing,
      heightMultiplier: style.height,
      halfLeading: true,
      shadows: style.shadow
        ? [
            {
              color: Skia.Color('rgba(0,0,0,0.6)'),
              offset: { x: 0, y: 0.3 * style.shadow },
              blurRadius: style.shadow,
            },
          ]
        : undefined,
    })
    builder.addText(text)
    const paragraph = builder.build()
    paragraph.layout(width)
    return paragraph
  }
}

const upper = (text: string, card: EntityCardView) => text.toLocaleUpperCase(card.language)

/**
 * French punctuation keeps to its word: a space inside « » and before ? ! ; : never breaks a
 * line. The catalog mostly writes these spaces unbreakable already; a few titles do not.
 */
const frenchSpaces = (text: string) =>
  text
    .replace(/« /g, '«\u00a0')
    .replace(/ »/g, '\u00a0»')
    .replace(/ ([?!;:])/g, '\u202f$1')

/** The original name, large: in the image on the front, under the family on the back. */
const original = (
  set: ReturnType<typeof makeSetter>,
  card: EntityCardView,
  u: number,
  width: number,
  align: TextAlign,
  hebrewSize: number,
  greekSize: number,
  height: number
) => {
  const hebrew = card.script === 'he'
  return set(
    card.original,
    {
      families: hebrew ? HEBREW : GREEK,
      size: (hebrew ? hebrewSize : greekSize) * u,
      color: '#fff',
      weight: hebrew ? 700 : 600,
      align,
      direction: hebrew ? TextDirection.RTL : TextDirection.LTR,
      height,
    },
    width
  )
}

export const buildFrontParagraphs = (
  card: EntityCardView,
  palette: CardPalette,
  fonts: SkTypefaceFontProvider,
  width: number
) => {
  const u = width / 100
  const set = makeSetter(fonts)
  const nameSize = 8 * u
  const typeSize = 2.6 * u
  const sourceSize = 2.5 * u
  const footSize = 2.4 * u
  const textWidth = 87 * u - 7.2 * u
  const fr = (text: string) => (card.language === 'fr' ? frenchSpaces(text) : text)
  const quoted = card.language === 'fr' ? `«\u00a0${card.sentence}\u00a0»` : `“${card.sentence}”`
  return {
    name: set(
      upper(card.name, card),
      { size: nameSize, color: '#fff', weight: 600, letterSpacing: 0.06 * nameSize, height: 1 },
      width
    ),
    title: set(
      fr(card.title),
      { size: 4.6 * u, color: '#f2ecdc', italic: true, height: 1.15, maxLines: 2, shadow: u },
      50 * u
    ),
    typeLine: set(
      upper(card.typeLine, card),
      {
        families: MONO,
        size: typeSize,
        color: palette.typeInk,
        align: TextAlign.Center,
        letterSpacing: 0.16 * typeSize,
      },
      88 * u
    ),
    sentence: set(
      fr(card.paraphrase ? card.sentence : quoted),
      {
        size: 3.8 * u,
        color: palette.panelInk,
        italic: card.paraphrase,
        align: TextAlign.Center,
        height: 1.3,
        maxLines: 4,
      },
      textWidth
    ),
    source: set(
      card.source,
      {
        families: MONO,
        size: sourceSize,
        color: palette.panelDim,
        align: TextAlign.Center,
        letterSpacing: 0.03 * sourceSize,
      },
      textWidth
    ),
    footLeft: set(
      card.foot,
      { families: MONO, size: footSize, color: palette.typeInk, height: 1.2, maxLines: 1 },
      62 * u
    ),
    footRight: set(
      `${card.chapterCount} ch.`,
      {
        families: MONO,
        size: footSize,
        color: palette.typeInk,
        align: TextAlign.Right,
        height: 1.2,
      },
      86 * u
    ),
    original: original(set, card, u, width - 8 * u, TextAlign.Right, 17, 13, 1),
  }
}

export type FrontParagraphs = ReturnType<typeof buildFrontParagraphs>

export const buildBackParagraphs = (
  card: EntityCardView,
  palette: CardPalette,
  fonts: SkTypefaceFontProvider,
  width: number
) => {
  const u = width / 100
  const set = makeSetter(fonts)
  const inner = width - 18 * u
  const words = CARD_WORDS[card.language]
  const familySize = 2.8 * u
  const termSize = 2.6 * u
  const fr = (text: string) => (card.language === 'fr' ? frenchSpaces(text) : text)
  const term = (text: string) =>
    set(
      upper(text, card),
      { families: MONO, size: termSize, color: palette.typeInk, letterSpacing: 0.06 * termSize },
      inner
    )
  const facts: [string, string][] = [
    [words.thisCard, `${card.title}${card.chaptersLabel ? ` · ${card.chaptersLabel}` : ''}`],
    [words.first, card.firstMention],
    [words.appears, words.chapters(card.chapterCount)],
    ...(card.total > 1 ? [[words.rank(card.rank, card.total), ''] as [string, string]] : []),
    ...(card.series ? [[words.series, card.series] as [string, string]] : []),
  ]
  const terms = facts.map(([label]) => term(label))
  // The terms share one column, as wide as the widest of them (`grid-template-columns: auto 1fr`).
  const termWidth = Math.max(0, ...terms.map(paragraph => paragraph.getMaxIntrinsicWidth()))
  const valueWidth = inner - termWidth - 3 * u
  return {
    family: set(
      upper(CARD_FAMILY_LABELS[card.family][card.language], card),
      {
        families: MONO,
        size: familySize,
        color: palette.typeInk,
        align: TextAlign.Center,
        letterSpacing: 0.18 * familySize,
      },
      inner
    ),
    original: original(set, card, u, inner, TextAlign.Center, 17, 14, 1.1),
    transliteration: card.transliteration
      ? set(
          card.transliteration,
          { size: 5 * u, color: palette.backInk, italic: true, align: TextAlign.Center },
          inner
        )
      : null,
    strong: card.strong
      ? set(card.strong, { families: MONO, size: 2.8 * u, color: palette.typeInk }, inner)
      : null,
    meaning: card.meaning
      ? set(
          card.language === 'fr' ? `«\u00a0${card.meaning}\u00a0»` : `“${card.meaning}”`,
          {
            size: 5.4 * u,
            color: palette.meaningInk ?? palette.backInk,
            weight: 500,
            align: TextAlign.Center,
          },
          inner
        )
      : null,
    brief: set(
      fr(card.brief),
      { size: 4.2 * u, color: palette.backInk, align: TextAlign.Center, height: 1.35 },
      inner
    ),
    facts: facts.map(([, value], index) => ({
      term: terms[index],
      value: value
        ? set(fr(value), { size: 3.5 * u, color: palette.backInk, height: 1.25 }, valueWidth)
        : null,
    })),
    termWidth,
  }
}

export type BackParagraphs = ReturnType<typeof buildBackParagraphs>

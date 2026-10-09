// What the smallest size of a card holds in its six lines. The renderer cuts an overflowing
// text in the middle of a word, so a longer verse is cut here first, at a word.
const LONGEST = 270

/** The text of a verse as its card prints it: whole, or cut at a word with an ellipsis. */
export const shareCardVerse = (text: string): string => cutAtWord(shareCardLine(text), LONGEST)

/** An excerpt under a title: two lines of the full width, or three beside a picture. */
export const shareCardExcerpt = (text: string, besidePicture: boolean): string =>
  cutAtWord(shareCardLine(text), besidePicture ? 92 : 105)

const cutAtWord = (text: string, length: number): string => {
  if (text.length <= length) return text
  const cut = text.slice(0, length)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > length * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/u, '')}…`
}

/** One line of plain text: the cards print no markup and no line break of the source. */
export const shareCardLine = (text: string): string => text.replace(/\s+/gu, ' ').trim()

/** How a card names the script of an original word. */
export const STRONG_SCRIPTS = {
  fr: { hebrew: 'Hébreu', greek: 'Grec' },
  en: { hebrew: 'Hebrew', greek: 'Greek' },
} as const

/** The lexicon sometimes writes a transliteration twice over ("shâlôm shâlôm"). */
export const firstSpelling = (transliteration: string): string => {
  const spellings = shareCardLine(transliteration).split(' ')
  return new Set(spellings).size === 1 ? spellings[0] : spellings.join(' ')
}

/** A description that opens on the work and the reference, without that opening. */
export const afterReference = (description: string, reference: string): string => {
  const at = description.indexOf(reference)
  return at === -1 ? description : description.slice(at + reference.length).replace(/^[\s:–—-]+/u, '')
}

/**
 * The address of a picture the renderer can read. It reads JPEG and PNG, not the WebP copy a
 * page shows: the card takes the original the media host keeps beside it.
 */
export const shareCardPicture = (webp: string | undefined): string | undefined => {
  const original = webp?.replace('/w1200/', '/original/').replace(/\.webp$/u, '')
  return original && /\.(?:jpe?g|png)$/iu.test(original) ? original : undefined
}

/** How a text read on a card is set: its size and the lines it may fill before it is cut. */
export type ShareCardTextFit = { fontSize: 52 | 46 | 38; lines: 4 | 5 | 6 }

// What a 900 pixel line of the reading face holds on average, at each size. A text that runs
// past its last line is cut there by the renderer, at a word, so an estimate is enough.
const FITS: readonly (ShareCardTextFit & { characters: number })[] = [
  { fontSize: 52, lines: 4, characters: 145 },
  { fontSize: 46, lines: 5, characters: 205 },
]
const SMALLEST: ShareCardTextFit = { fontSize: 38, lines: 6 }

/** A verse steps down in size as it gets longer and is never set smaller than 38 pixels. */
export const fitShareCardText = (text: string): ShareCardTextFit => {
  const { fontSize, lines } = FITS.find(fit => text.length <= fit.characters) ?? SMALLEST
  return { fontSize, lines }
}

// What the smallest size holds in its six lines. The renderer cuts an overflowing text in
// the middle of a word, so a longer verse is cut here first, at a word.
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

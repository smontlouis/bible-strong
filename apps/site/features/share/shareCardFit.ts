/** How a text read on a card is set: its size and the lines it may fill before it is cut. */
export type ShareCardTextFit = { fontSize: 52 | 46 | 38; lines: 4 | 5 | 6 }

// What a 900 pixel line of the reading face holds on average, at each size. The site cuts a
// text too long for the smallest size before it describes the card.
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

export default function truncate(str: string, maxChars: number) {
  if (!str || str.length <= maxChars) return str

  // Trim any leading/trailing spaces and collapse multiple spaces
  const cleanStr = str.replace(/\s+/g, ' ').trim()
  if (cleanStr.length <= maxChars) return cleanStr

  // Cut to maxChars, but don't break a word, include last whole word
  let cutPoint = maxChars
  while (cutPoint > 0 && cleanStr[cutPoint] && cleanStr[cutPoint] !== ' ') {
    cutPoint--
  }

  // If no space found (single long word), show up to maxChars and add …
  if (cutPoint === 0) {
    return cleanStr.slice(0, maxChars) + '...'
  }

  // Use the substring up to the last space before maxChars
  return cleanStr.slice(0, cutPoint) + '...'
}

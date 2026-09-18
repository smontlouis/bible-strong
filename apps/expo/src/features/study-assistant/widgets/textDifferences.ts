/** Word alignment only: it does not assert equivalent meaning across translations. */
export function textDifferences(text: string, reference: string) {
  const parts = text.split(/(\s+)/u)
  const words = parts.filter(part => part && !/^\s+$/u.test(part))
  const base = reference.split(/\s+/u).filter(Boolean)
  // Bound quadratic work for exceptionally large imported verses.
  if (words.length > 512 || base.length > 512) return [{ text, different: false }]
  const normalize = (word: string) =>
    word.normalize('NFC').toLocaleLowerCase().replace(/[’]/gu, "'")
  const a = words.map(normalize),
    b = base.map(normalize)
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lengths[i][j] =
        a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1])
  const common = new Set<number>()
  let i = 0,
    j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      common.add(i)
      i++
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++
    else j++
  }
  let word = 0
  return parts.map(part => ({
    text: part,
    different: part && !/^\s+$/u.test(part) ? !common.has(word++) : false,
  }))
}

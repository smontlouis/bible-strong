/** Shorten before the index's own 160-character cutoff, never displaying its partial last word. */
export function formatCommentaryExcerpt(excerpt: string, maxLength = 120): string {
  const text = excerpt.replace(/\s+/gu, ' ').trim()
  if (text.length <= maxLength) return text
  const boundary = text.lastIndexOf(' ', maxLength)
  const prefix = boundary > 0 ? text.slice(0, boundary) : text.split(' ')[0]
  return `${prefix.replace(/[\s,;:–—.-]+$/gu, '')}…`
}

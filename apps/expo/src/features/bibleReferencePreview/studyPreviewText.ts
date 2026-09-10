const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Reading excerpt: retain authored text and the labels of embedded study objects. */
export function studyPreviewText(content: unknown): string {
  if (!record(content)) return ''
  const ops = Array.isArray(content.ops)
    ? content.ops
    : record(content.ops)
      ? Object.values(content.ops)
      : []
  return ops
    .map(op => {
      if (!record(op)) return ''
      if (typeof op.insert === 'string') return op.insert
      if (!record(op.insert)) return ''
      return Object.values(op.insert)
        .map(embed => {
          if (!record(embed)) return ''
          const display = record(embed.display)
            ? embed.display
            : record(embed.fallback)
              ? embed.fallback
              : embed
          return typeof display.title === 'string' ? `\n${display.title}\n` : ''
        })
        .join('')
    })
    .join('')
    .trim()
}

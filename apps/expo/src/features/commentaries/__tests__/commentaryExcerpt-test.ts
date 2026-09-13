import { formatCommentaryExcerpt } from '../commentaryExcerpt'

it('keeps a complete short excerpt unchanged', () => {
  expect(formatCommentaryExcerpt('Un témoignage fidèle.')).toBe('Un témoignage fidèle.')
})

it('ends on a whole word with an ellipsis', () => {
  expect(formatCommentaryExcerpt('Luc présente les récits de son enfance.', 20)).toBe(
    'Luc présente les…'
  )
})

it('discards the incomplete word at the end of a capped API excerpt', () => {
  const excerpt = 'Les témoins transmettent leur récit. '.repeat(5).slice(0, 160)
  const result = formatCommentaryExcerpt(excerpt)
  expect(result.endsWith('…')).toBe(true)
  expect(result.length).toBeLessThanOrEqual(121)
  expect(excerpt.startsWith(result.slice(0, -1))).toBe(true)
  expect(excerpt[result.length - 1]).toBe(' ')
})

it('normalizes whitespace and removes trailing punctuation before the ellipsis', () => {
  expect(formatCommentaryExcerpt('Luc,   puis les autres témoins', 10)).toBe('Luc, puis…')
})

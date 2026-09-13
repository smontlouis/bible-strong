import {
  normalizeInlineCommentaries,
  getInlineCommentaryResources,
  isInlineCommentaryEligible,
} from '../inlineCommentarySelection'
jest.mock('../commentarySelection', () => ({
  parseCommentaryProjectionId: (value: string) =>
    ['barnes:fr', 'acbc:fr', 'mhy-fr:fr', 'egw-writings:en', 'sdabc:fr'].includes(value)
      ? { projectionId: value, resourceId: value.split(':')[0], language: 'fr' }
      : undefined,
}))
it('keeps an opt-in subset in the resource selection order', () => {
  expect(
    normalizeInlineCommentaries(
      ['acbc:fr', 'barnes:fr', 'barnes:fr', 'invalid'],
      ['barnes:fr', 'acbc:fr']
    )
  ).toEqual(['barnes:fr', 'acbc:fr'])
  expect(normalizeInlineCommentaries(['barnes:fr'], ['acbc:fr'])).toEqual([])
  expect(normalizeInlineCommentaries(undefined, ['barnes:fr'])).toEqual([])
})

it('excludes associated EGW writings from inline settings and previously saved requests only', () => {
  const selected = ['egw-writings:en', 'barnes:fr', 'sdabc:fr']
  expect(selected.filter(isInlineCommentaryEligible)).toEqual(['barnes:fr', 'sdabc:fr'])
  expect(normalizeInlineCommentaries(selected, selected)).toEqual(['barnes:fr', 'sdabc:fr'])
  expect(getInlineCommentaryResources(['egw-writings:en'], selected)).toEqual([])
  expect(selected).toEqual(['egw-writings:en', 'barnes:fr', 'sdabc:fr'])
})

it('uses MHY publication identity for the legacy French Henry selection', () => {
  expect(getInlineCommentaryResources(['mhy-fr:fr'], ['mhy-fr:fr'])).toEqual([
    { resourceId: 'MHY', language: 'fr' },
  ])
})

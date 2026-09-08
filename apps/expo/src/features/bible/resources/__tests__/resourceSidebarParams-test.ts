import { parseResourceSidebarParams } from '../resourceSidebarParams'

it('keeps the resource and exact passage available after a reload', () => {
  expect(parseResourceSidebarParams('commentary', '{"6-3-5":true,"6-3-6":true}')).toEqual({
    resourceType: 'commentary',
    selectedVerses: { '6-3-5': true, '6-3-6': true },
  })
})
it('does not pass malformed selections to the resource reader', () => {
  expect(parseResourceSidebarParams('unknown', 'invalid')).toEqual({
    resourceType: 'strong',
    selectedVerses: {},
  })
  expect(
    parseResourceSidebarParams(
      'compare',
      '{"invalid":true,"1-0-1":true,"1-1-1":false,"1-1-2":true}'
    ).selectedVerses
  ).toEqual({ '1-1-2': true })
  expect(parseResourceSidebarParams('strong', '["1-1-1"]')).toEqual({
    resourceType: 'strong',
    selectedVerses: {},
  })
})

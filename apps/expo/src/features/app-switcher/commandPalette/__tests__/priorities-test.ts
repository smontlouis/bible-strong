import { tabContentKey, resultContentKey } from '../priorities'

it('identifies a plan independently from its tab title', () => {
  const opened = tabContentKey({
    id: 'tab1',
    type: 'plan',
    title: 'My renamed plan',
    isRemovable: true,
    data: { planId: 'plan1' },
  })
  expect(opened).toBe(
    tabContentKey({
      type: 'plan',
      title: 'Original plan title',
      isRemovable: true,
      data: { planId: 'plan1' },
    })
  )
})
it('keeps notes with identical titles separate and matches the actual opened note', () => {
  const opened = tabContentKey({
    id: 'tab1',
    type: 'notes',
    title: 'Note',
    isRemovable: true,
    data: { noteId: 'a' },
  })
  expect(
    resultContentKey({
      id: 'a',
      title: 'Note',
      type: 'notes',
      iconType: 'notes',
      endpoint: { type: 'note', noteId: 'a' },
    })
  ).toBe(opened)
  expect(
    resultContentKey({
      id: 'b',
      title: 'Note',
      type: 'notes',
      iconType: 'notes',
      endpoint: { type: 'note', noteId: 'b' },
    })
  ).not.toBe(opened)
})
it('does not hide contents just because their list tab is open', () => {
  expect(
    tabContentKey({ id: 'tab1', type: 'notes', title: 'Notes', isRemovable: true, data: {} })
  ).toBeUndefined()
})

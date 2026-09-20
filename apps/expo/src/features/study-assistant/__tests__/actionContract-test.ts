import {
  parseAssistantAction,
  parseStudyEvent,
  parseStudyRequest,
} from '@bible-strong/ai-contract/contract'

const openGenesisInDarby = {
  id: 'open-genesis-4-3',
  kind: 'open_tab',
  tabType: 'bible',
  target: {
    kind: 'passage',
    book: 1,
    chapter: 4,
    startVerse: 3,
    endVerse: 3,
    version: 'DARBY',
  },
} as const

it('parses a bounded open-tab action from the study stream', () => {
  expect(parseStudyEvent({ type: 'action', action: openGenesisInDarby })).toEqual({
    type: 'action',
    action: openGenesisInDarby,
  })
})

it('rejects malformed or expanded open-tab capabilities', () => {
  expect(() =>
    parseAssistantAction({
      ...openGenesisInDarby,
      target: { ...openGenesisInDarby.target, endVerse: 2 },
    })
  ).toThrow('INVALID_ACTION')
  expect(() => parseAssistantAction({ ...openGenesisInDarby, destructive: true })).toThrow(
    'INVALID_ACTION'
  )
})

it('accepts only explicitly supported client capabilities', () => {
  expect(parseStudyRequest({ question: 'Ouvre un onglet', clientCapabilities: ['open_tab'] }))
    .toMatchObject({ clientCapabilities: ['open_tab'] })
  expect(() =>
    parseStudyRequest({ question: 'Écris une note', clientCapabilities: ['write_note'] })
  ).toThrow('INVALID_CLIENT_CAPABILITIES')
})

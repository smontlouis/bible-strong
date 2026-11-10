import {
  parseAssistantAction,
  parseStudyEvent,
  parseStudyQuota,
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
  expect(
    parseStudyRequest({ question: 'Ouvre un onglet', clientCapabilities: ['open_tab'] })
  ).toMatchObject({ clientCapabilities: ['open_tab'] })
  expect(() =>
    parseStudyRequest({ question: 'Écris une note', clientCapabilities: ['write_note'] })
  ).toThrow('INVALID_CLIENT_CAPABILITIES')
})

it('accepts the quota capability and parses the three kinds of quota', () => {
  expect(parseStudyRequest({ question: 'Combien ?', clientCapabilities: ['quota'] })).toMatchObject(
    { clientCapabilities: ['quota'] }
  )
  const daily = { kind: 'daily', limit: 3, remaining: 1, resetsAt: '2026-11-11T00:00:00.000Z' }
  expect(parseStudyEvent({ type: 'quota', quota: daily })).toEqual({ type: 'quota', quota: daily })
  expect(parseStudyQuota({ kind: 'unlimited' })).toEqual({ kind: 'unlimited' })
  expect(parseStudyQuota({ kind: 'verify_email', limit: 3 })).toEqual({
    kind: 'verify_email',
    limit: 3,
  })
  expect(() => parseStudyQuota({ ...daily, remaining: 5 })).toThrow('INVALID_QUOTA')
  expect(() => parseStudyQuota({ kind: 'unlimited', premium: true })).toThrow('INVALID_QUOTA')
})

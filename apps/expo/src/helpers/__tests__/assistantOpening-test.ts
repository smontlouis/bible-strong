import { getDefaultStore } from 'jotai/vanilla'

import {
  assistantOpeningAtom,
  closedOpening,
  hasOpeningAccess,
  parseBetaUids,
  publishAssistantOpening,
} from '../assistantOpening'

const tester = 'p0VPP67AxSRp98KKWMWl2wWhBMP2'
const other = 'Anr64tUdQKYKtskaluahn2Pecg22'

it('accepts only complete Firebase uids from the list', () => {
  expect([...parseBetaUids(` ${tester},invalid uid,,${other} `)]).toEqual([tester, other])
})

it('lets no one in until Remote Config answers', () => {
  expect(hasOpeningAccess(closedOpening, tester)).toBe(false)
})

it('lets only the exact uids of the beta list in while it is closed', () => {
  const opening = { open: false, betaUids: new Set([tester]) }
  expect(hasOpeningAccess(opening, tester)).toBe(true)
  expect(hasOpeningAccess(opening, tester.slice(0, -1))).toBe(false)
  expect(hasOpeningAccess(opening, other)).toBe(false)
  expect(hasOpeningAccess(opening, undefined)).toBe(false)
})

it('lets every signed-in account in once it is open, and no one signed out', () => {
  const opening = { open: true, betaUids: new Set<string>() }
  expect(hasOpeningAccess(opening, other)).toBe(true)
  expect(hasOpeningAccess(opening, null)).toBe(false)
})

it('publishes what Remote Config holds', () => {
  publishAssistantOpening({ open: false, betaUids: `${tester}, ${other}` })
  const opening = getDefaultStore().get(assistantOpeningAtom)
  expect(opening.open).toBe(false)
  expect(hasOpeningAccess(opening, other)).toBe(true)
  publishAssistantOpening({ open: true })
  expect(getDefaultStore().get(assistantOpeningAtom)).toEqual({ open: true, betaUids: new Set() })
})

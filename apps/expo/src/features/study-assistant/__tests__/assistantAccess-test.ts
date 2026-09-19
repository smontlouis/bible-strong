import { hasAssistantBetaAccess, parseAssistantBetaUids } from '../assistantAccess'

it('accepts only complete configured Firebase UIDs', () => {
  const allowed = parseAssistantBetaUids(
    ' p0VPP67AxSRp98KKWMWl2wWhBMP2,invalid uid,,Anr64tUdQKYKtskaluahn2Pecg22 '
  )
  expect([...allowed]).toEqual(['p0VPP67AxSRp98KKWMWl2wWhBMP2', 'Anr64tUdQKYKtskaluahn2Pecg22'])
})

it('uses exact UID membership and denies missing or partial identities', () => {
  const allowed = new Set(['p0VPP67AxSRp98KKWMWl2wWhBMP2'])
  expect(hasAssistantBetaAccess('p0VPP67AxSRp98KKWMWl2wWhBMP2', allowed)).toBe(true)
  expect(hasAssistantBetaAccess('p0VPP67AxSRp98KKWMWl2wWhBMP', allowed)).toBe(false)
  expect(hasAssistantBetaAccess(undefined, allowed)).toBe(false)
})

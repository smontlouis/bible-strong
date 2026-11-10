import { assistantAuthHeaders } from '../assistantAuthHeaders'

jest.mock('~helpers/resourceAppCheck', () => ({
  getResourceAppCheckToken: () => Promise.reject(new Error('no attestation')),
}))

const account = (emailVerified: boolean, claimed: boolean | undefined) => {
  const getIdToken = jest.fn(async (forceRefresh?: boolean) => (forceRefresh ? 'fresh' : 'cached'))
  return {
    getIdToken,
    getIdTokenResult: async () => ({
      claims: claimed === undefined ? {} : { email_verified: claimed },
    }),
    emailVerified,
  }
}

it('sends the cached token unless an address was verified after it was issued', async () => {
  expect(await assistantAuthHeaders(account(false, false))).toEqual({
    Authorization: 'Bearer cached',
  })
  expect(await assistantAuthHeaders(account(true, true))).toEqual({
    Authorization: 'Bearer cached',
  })
  expect(await assistantAuthHeaders(account(true, undefined))).toEqual({
    Authorization: 'Bearer cached',
  })
  const verifiedSince = account(true, false)
  expect(await assistantAuthHeaders(verifiedSince)).toEqual({ Authorization: 'Bearer fresh' })
  expect(verifiedSince.getIdToken).toHaveBeenCalledWith(true)
})

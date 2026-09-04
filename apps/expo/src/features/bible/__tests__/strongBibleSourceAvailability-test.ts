/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://cdn.test/${path}`,
  firebaseStorage: {},
}))

import { loadStrongBibleSourceAvailability } from '../resources/loadStrongBibleSourceAvailability'

describe('Strong Bible source availability', () => {
  it('keeps remotely readable Strong and BHG sources selectable', async () => {
    const getStrongAvailability = jest.fn().mockResolvedValue({
      status: 'available',
      textRevision: 'online-r1',
    })
    const getInterlinearAvailability = jest.fn().mockResolvedValue({
      status: 'available',
      locale: 'fr',
      textRevision: 'bhg-online-r1',
    })

    const result = await loadStrongBibleSourceAvailability({
      versionIds: ['LSG', 'DBY'],
      includeBhg: true,
      preferredInterlinearLocale: 'fr',
      getStrongAvailability,
      getInterlinearAvailability,
    })

    expect(result.availabilityByVersion.get('LSG')?.status).toBe('available')
    expect(result.availabilityByVersion.get('DBY')?.status).toBe('available')
    expect(result.bhgAvailability).toEqual({ status: 'available', locale: 'fr' })
  })
})

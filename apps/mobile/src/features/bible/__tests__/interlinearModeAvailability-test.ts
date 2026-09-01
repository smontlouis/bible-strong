import { loadInterlinearModeAvailability } from '../loadInterlinearModeAvailability'

describe('Interlinear mode availability', () => {
  it('preserves online availability when no Offline copy is installed', async () => {
    const getAvailability = jest.fn().mockImplementation(async locale => ({
      status: 'available',
      locale,
      textRevision: 'bhg-online-r1',
    }))

    await expect(loadInterlinearModeAvailability(getAvailability)).resolves.toEqual({
      fr: { status: 'available', locale: 'fr', textRevision: 'bhg-online-r1' },
      en: { status: 'available', locale: 'en', textRevision: 'bhg-online-r1' },
    })
    expect(getAvailability).toHaveBeenCalledTimes(2)
  })
})

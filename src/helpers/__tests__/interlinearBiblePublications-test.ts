import { BHG_INTERLINEAR_PUBLICATION } from '../interlinearBiblePublications'

jest.mock('../firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

describe('BHG interlinear publication', () => {
  it('publishes the V5 concordance indexes from the CDN', () => {
    expect(BHG_INTERLINEAR_PUBLICATION.indexes).toEqual({
      fr: expect.objectContaining({
        schemaVersion: 5,
        archiveSha256: 'ce838424d8216cf38294e312090fcfb93219b74d26170bcbda3a593c609affaf',
        archiveBytes: 22341508,
        contentSha256: 'ccdd3b82ceb1a4cdc24a3b1a503cd04601310191430b680d3089d98287b1b58f',
        contentBytes: 54296576,
      }),
      en: expect.objectContaining({
        schemaVersion: 5,
        archiveSha256: 'ababa969bc4aaa2aed464b391beff3a85f189626989fbbc3c99beb9a03ddd4ff',
        archiveBytes: 22735720,
        contentSha256: '21707289025e9b907e87d5af56d1aefb10036e16164dccf03cc09c15d6f84462',
        contentBytes: 55119872,
      }),
    })
  })
})

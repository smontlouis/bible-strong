import { BHG_INTERLINEAR_PUBLICATION } from '../interlinearBiblePublications'

jest.mock('../firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

describe('BHG interlinear publication', () => {
  it('publishes the V5 concordance indexes from the CDN', () => {
    expect(BHG_INTERLINEAR_PUBLICATION.indexes).toEqual({
      fr: expect.objectContaining({
        schemaVersion: 5,
        archiveSha256: '01c757b213c0b467a6ae0d405f7e911ea516eed4159485b591f5b3196e9905ec',
        archiveBytes: 22536568,
        contentSha256: 'e5581a22d74be411e762936a5094e1ad4873c6fe7b98cbb49adc25fbd8ea2294',
        contentBytes: 54296576,
      }),
      en: expect.objectContaining({
        schemaVersion: 5,
        archiveSha256: '5bcfee1b51c1a24222475f6bbdae0ea433a620102987a0448a883eed3dacf2eb',
        archiveBytes: 22945644,
        contentSha256: 'be13b954bda6cef2525d46d2421c7ea64f80adf0f0c34e7b767d40eb96526a34',
        contentBytes: 55119872,
      }),
    })
  })
})

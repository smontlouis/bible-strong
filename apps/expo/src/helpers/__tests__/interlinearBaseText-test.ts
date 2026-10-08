import { resolveInstalledInterlinearBaseText } from '../interlinearBaseText'

jest.mock('../biblesDb', () => ({
  getBibleVersionMetadata: jest.fn(),
  setBibleVersionTextIdentity: jest.fn(),
}))
jest.mock('../firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

const published = {
  textRevision: 'bhg-803c482ed06005693547',
  textSha256: '803c482ed06005693547f9ea04a2dcbec4718c1d97ab0c531d60600e4c3a9d8f',
}
const next = {
  textRevision: 'bhg-e15bd9f0f1a91140579c',
  textSha256: 'e15bd9f0f1a91140579c9eb9c8f4e173b8a4df361859758e0fe252ef55edc107',
}

describe('resolveInstalledInterlinearBaseText', () => {
  it('keeps a record that names the text its archive carries', () => {
    expect(
      resolveInstalledInterlinearBaseText(
        { ...published, schemaVersion: 1, resourceGeneration: 'a'.repeat(64) },
        published
      )
    ).toEqual({ text: published })
  })

  it('corrects the revision 27.1.1 compiled in over the archive it had installed', () => {
    // 27.1.1 installed the next archive and recorded the revision it was built with.
    expect(
      resolveInstalledInterlinearBaseText(
        { ...published, schemaVersion: 1, resourceGeneration: 'b'.repeat(64) },
        next
      )
    ).toEqual({ text: next, correction: next })
  })

  it('never corrects a copy installed from a file that declares its revision', () => {
    const record = { ...next, schemaVersion: 4, resourceGeneration: 'b'.repeat(64) }

    expect(resolveInstalledInterlinearBaseText(record, published)).toEqual({ text: next })
  })

  it('keeps the record when no catalog lists the installed archive', () => {
    expect(
      resolveInstalledInterlinearBaseText(
        { ...published, schemaVersion: 1, resourceGeneration: 'c'.repeat(64) },
        undefined
      )
    ).toEqual({ text: published })
  })

  it('names nothing for a copy installed without a revision that no catalog lists', () => {
    expect(resolveInstalledInterlinearBaseText({}, undefined)).toEqual({ text: {} })
  })
})

import {
  getStrongBiblePublication,
  getStrongDatasetId,
  isStrongCapableBibleVersion,
  resolveStrongNavigationVersionId,
  resolveStrongBibleVersion,
} from '../strongBiblePublications'

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

describe('Strong Bible publications', () => {
  it.each([
    ['LSG', 'LSG'],
    ['DBY', 'DBY'],
    ['DBR', 'DBYR'],
  ])('maps application version %s to dataset %s', (versionId, datasetId) => {
    expect(getStrongDatasetId(versionId)).toBe(datasetId)
    expect(isStrongCapableBibleVersion(versionId)).toBe(true)
  })

  it('maps the legacy LSGS identity to logical LSG with Strong visible', () => {
    expect(resolveStrongBibleVersion('LSGS')).toEqual({
      versionId: 'LSG',
      strongMode: 'visible',
    })
  })

  it('keeps a regular version and its requested mode unchanged', () => {
    expect(resolveStrongBibleVersion('DBY', 'hidden')).toEqual({
      versionId: 'DBY',
      strongMode: 'hidden',
    })
  })

  it('preserves the current Strong-capable Bible in direct Strong navigation', () => {
    expect(resolveStrongNavigationVersionId('DBY')).toBe('DBY')
    expect(resolveStrongNavigationVersionId('LSGS')).toBe('LSG')
    expect(resolveStrongNavigationVersionId('KJV')).toBeUndefined()
  })

  it('declares a revision-compatible pair for every supported Bible', () => {
    for (const versionId of ['LSG', 'DBY', 'DBR'] as const) {
      const publication = getStrongBiblePublication(versionId)
      expect(publication.canonical.textRevision).toBe(publication.strong.textRevision)
      expect(publication.canonical.textSha256).toBe(publication.strong.textSha256)
      expect(publication.canonical.url).toMatch(/\.json\.zip(?:\?|$)/)
      expect(publication.strong.url).toMatch(/\.sqlite\.zip(?:\?|$)/)
    }
  })
})

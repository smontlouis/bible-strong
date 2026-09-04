import {
  getStrongBiblePublication,
  getStrongBibleFallbackPriority,
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
    ['KJV', 'KJV'],
    ['NASB2020', 'NASB2020'],
    ['NASB1995', 'NASB1995'],
    ['BSB', 'BSB'],
    ['ASV', 'ASV'],
    ['DARBY', 'DARBY_EN'],
    ['RLT', 'RLT'],
    ['RWEBSTER', 'RWEBSTER'],
    ['RV1895', 'RV1895'],
  ])('maps application version %s to dataset %s', (versionId, datasetId) => {
    expect(getStrongDatasetId(versionId)).toBe(datasetId)
    expect(isStrongCapableBibleVersion(versionId)).toBe(true)
  })

  it('uses an English fallback order for English Bibles without their own index', () => {
    expect(getStrongBibleFallbackPriority('NIV')[0]).toBe('KJV')
    expect(getStrongBibleFallbackPriority('BFC')[0]).toBe('LSG')
  })

  it('keeps a regular version and its requested mode unchanged', () => {
    expect(resolveStrongBibleVersion('DBY', 'hidden')).toEqual({
      versionId: 'DBY',
      strongMode: 'hidden',
    })
  })

  it('preserves the current Strong-capable Bible in direct Strong navigation', () => {
    expect(resolveStrongNavigationVersionId('DBY')).toBe('DBY')
    expect(resolveStrongNavigationVersionId('KJV')).toBe('KJV')
  })

  it('declares a revision-compatible pair for every supported Bible', () => {
    for (const versionId of [
      'LSG',
      'DBY',
      'DBR',
      'KJV',
      'NASB2020',
      'NASB1995',
      'BSB',
      'ASV',
      'DARBY',
      'RLT',
      'RWEBSTER',
      'RV1895',
    ] as const) {
      const publication = getStrongBiblePublication(versionId)
      expect(publication.canonical.textRevision).toBe(publication.strong.textRevision)
      expect(publication.canonical.textSha256).toBe(publication.strong.textSha256)
      expect(publication.canonical.url).toMatch(/\.json\.zip(?:\?|$)/)
      expect(publication.strong.url).toMatch(/\.sqlite\.zip(?:\?|$)/)
    }
  })
})

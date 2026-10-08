import { BUNDLED_MOBILE_RESOURCE_CATALOG } from '../mobileResourceCatalog'
import {
  getStrongBiblePublication,
  getStrongBibleFallbackPriority,
  getStrongDatasetId,
  isStrongCapableBibleVersion,
  resolveStrongNavigationVersionId,
  resolveStrongBibleVersion,
  REVERSE_INTERLINEAR_MIN_SCHEMA_VERSION,
  STRONG_BIBLE_INDEX_MIN_SCHEMA_VERSION,
  STRONG_BIBLE_PUBLICATIONS,
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

  it('reads every supported Bible and its index from the catalog the application holds', () => {
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
      const canonical = BUNDLED_MOBILE_RESOURCE_CATALOG.resources[`bible:${versionId}`]!
      const strong = BUNDLED_MOBILE_RESOURCE_CATALOG.resources[`bible-strong:${versionId}`]!
      expect(publication.canonical).toMatchObject({
        entry: canonical.entry,
        archiveSha256: canonical.archiveSha256,
        archiveBytes: canonical.archiveBytes,
      })
      expect(publication.strong).toMatchObject({
        entry: strong.entry,
        archiveSha256: strong.archiveSha256,
        archiveBytes: strong.archiveBytes,
      })
      expect(publication.canonical.url).toMatch(/\.json\.zip(?:\?|$)/)
      expect(publication.strong.url).toMatch(/\.sqlite\.zip(?:\?|$)/)
    }
  })

  it('compiles no published revision into the application', () => {
    // A republished Bible or index must never need an application release (ADR-0079).
    expect(JSON.stringify(STRONG_BIBLE_PUBLICATIONS)).not.toMatch(/[a-f0-9]{20}/)
    expect(STRONG_BIBLE_INDEX_MIN_SCHEMA_VERSION).toBe(4)
    expect(REVERSE_INTERLINEAR_MIN_SCHEMA_VERSION).toBe(2)
  })
})

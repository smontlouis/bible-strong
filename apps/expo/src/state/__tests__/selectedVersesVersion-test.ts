import { getSelectedVersesVersion } from '../bibleSelectionVersion'

type VersionCode = 'LSG' | 'KJV'

const data = (selectedVersesVersion?: VersionCode, parallelVersions: VersionCode[] = ['KJV']) => ({
  selectedVersion: 'LSG' as VersionCode,
  selectedVersesVersion,
  parallelVersions,
})

describe('getSelectedVersesVersion', () => {
  it('keeps the main version when the selection names none', () => {
    expect(getSelectedVersesVersion(data())).toBe('LSG')
  })

  it('names the parallel version the verses were selected in', () => {
    expect(getSelectedVersesVersion(data('KJV'))).toBe('KJV')
  })

  it('falls back to the main version once that version is no longer on screen', () => {
    expect(getSelectedVersesVersion(data('KJV', []))).toBe('LSG')
  })
})

import {
  LEGACY_PUBLICATION_CANDIDATES,
  LEGACY_REFERENCE_EVIDENCE_KEY,
  getLegacyResourceFileCandidates,
} from '../legacyResourceEvidence'
import { createLegacyResourceCleanup } from '../legacyResourceCleanup'

describe('legacy resource migration runtime cleanup', () => {
  const documentDirectory = 'file:///documents/'

  it('deletes only allowlisted identity files and removes the obsolete installed Bible', async () => {
    const deleteFile = jest.fn(async (_path: string) => {})
    const removeInstalledBibleVersion = jest.fn(async () => {})
    const cleanup = createLegacyResourceCleanup({
      documentDirectory,
      deleteFile,
      getInstalledBibleVersions: async () => ['LSGS', 'LSG'],
      removeInstalledBibleVersion,
      storage: { getString: () => undefined, set: jest.fn(), remove: jest.fn() },
      resetReferenceEvidenceCapture: jest.fn(),
    })

    await cleanup.cleanupLegacyIdentity('LSGS')

    const expectedPaths = [
      ...getLegacyResourceFileCandidates(documentDirectory, 'fr'),
      ...getLegacyResourceFileCandidates(documentDirectory, 'en'),
    ]
      .filter(candidate => candidate.identity === 'LSGS')
      .map(candidate => candidate.path)
    expect(deleteFile.mock.calls.map(([path]) => path).sort()).toEqual(
      [...new Set(expectedPaths)].sort()
    )
    expect(deleteFile).not.toHaveBeenCalledWith('file:///documents/SQLite/bible-lsg-strong.sqlite')
    expect(removeInstalledBibleVersion).toHaveBeenCalledWith('LSGS')
  })

  it('strips obsolete queue items and metadata before recording terminal cleanup', async () => {
    const values = new Map<string, string | boolean>([
      [
        'downloadQueue',
        JSON.stringify([
          { item: { id: 'bible:LSGS', versionId: 'LSGS' }, status: 'queued' },
          { item: { id: 'bible:LSG', versionId: 'LSG' }, status: 'queued' },
        ]),
      ],
      ['tabGroupsAtom', JSON.stringify([{ id: 'default', tabs: [], activeTabIndex: 0 }])],
      ['tabsAtom', JSON.stringify([{ id: 'old' }])],
      ['activeTabIndexAtomOriginal', '0'],
      [LEGACY_REFERENCE_EVIDENCE_KEY, JSON.stringify(['LSGS'])],
    ])
    const operations: string[] = []
    const resetReferenceEvidenceCapture = jest.fn(() => operations.push('reset-evidence'))
    const cleanup = createLegacyResourceCleanup({
      documentDirectory,
      deleteFile: async () => {},
      getInstalledBibleVersions: async () => [],
      removeInstalledBibleVersion: async () => {},
      storage: {
        getString: key => {
          const value = values.get(key)
          return typeof value === 'string' ? value : undefined
        },
        set: (key, value) => {
          operations.push(`set:${key}`)
          values.set(key, value)
        },
        remove: key => {
          operations.push(`remove:${key}`)
          values.delete(key)
        },
      },
      resetReferenceEvidenceCapture,
    })

    await cleanup.finalizeCleanup()

    expect(values.get('downloadQueue')).toBe(
      JSON.stringify([{ item: { id: 'bible:LSG', versionId: 'LSG' }, status: 'queued' }])
    )
    expect(LEGACY_PUBLICATION_CANDIDATES.every(({ key }) => !values.has(key))).toBe(true)
    expect(values.has(LEGACY_REFERENCE_EVIDENCE_KEY)).toBe(false)
    expect(values.has('tabsAtom')).toBe(false)
    expect(values.has('activeTabIndexAtomOriginal')).toBe(false)
    expect(resetReferenceEvidenceCapture).toHaveBeenCalledTimes(1)
    expect(values.get('hasCleanedLegacyBibleResourcesV1')).toBe(true)
    expect(operations.at(-1)).toBe('set:hasCleanedLegacyBibleResourcesV1')
  })

  it('does not remove the installed version when an allowlisted file deletion fails', async () => {
    const removeInstalledBibleVersion = jest.fn(async () => {})
    const cleanup = createLegacyResourceCleanup({
      documentDirectory,
      deleteFile: async () => {
        throw new Error('disk failure')
      },
      getInstalledBibleVersions: async () => ['KJVS'],
      removeInstalledBibleVersion,
      storage: { getString: () => undefined, set: jest.fn(), remove: jest.fn() },
      resetReferenceEvidenceCapture: jest.fn(),
    })

    await expect(cleanup.cleanupLegacyIdentity('KJVS')).rejects.toThrow('disk failure')
    expect(removeInstalledBibleVersion).not.toHaveBeenCalled()
  })

  it('does not record terminal cleanup when metadata deletion fails', async () => {
    const set = jest.fn()
    const cleanup = createLegacyResourceCleanup({
      documentDirectory,
      deleteFile: async () => {},
      getInstalledBibleVersions: async () => [],
      removeInstalledBibleVersion: async () => {},
      storage: {
        getString: () => undefined,
        set,
        remove: () => {
          throw new Error('storage failure')
        },
      },
      resetReferenceEvidenceCapture: jest.fn(),
    })

    await expect(cleanup.finalizeCleanup()).rejects.toThrow('storage failure')
    expect(set).not.toHaveBeenCalledWith('hasCleanedLegacyBibleResourcesV1', true)
  })
})

/* eslint-disable import/first */

const mockDeletePericopeFile = jest.fn()
const mockDeleteRedWordsFile = jest.fn()
const mockClearPericopeCache = jest.fn()
const mockClearRedWordsCache = jest.fn()

jest.mock('../pericopes', () => ({
  requirePericopePath: (versionId: string) =>
    `file:///documents/bible-${versionId.toLowerCase()}-pericope.json`,
  deletePericopeFile: (...args: unknown[]) => mockDeletePericopeFile(...args),
}))
jest.mock('../redWords', () => ({
  requireRedWordsPath: (versionId: string) => `file:///documents/red-words-${versionId}.json`,
  deleteRedWordsFile: (...args: unknown[]) => mockDeleteRedWordsFile(...args),
}))
jest.mock('../loadPericope', () => ({
  clearPericopeCache: (...args: unknown[]) => mockClearPericopeCache(...args),
}))
jest.mock('../loadRedWords', () => ({
  clearRedWordsCache: (...args: unknown[]) => mockClearRedWordsCache(...args),
}))

import { removeLegacyBibleSideFiles } from '../legacyBibleSideFiles'

describe('legacy Bible side files', () => {
  beforeEach(() => jest.clearAllMocks())

  it('removes both side files and their loader caches', async () => {
    await removeLegacyBibleSideFiles('NBS')

    expect(mockDeletePericopeFile).toHaveBeenCalledWith('NBS')
    expect(mockDeleteRedWordsFile).toHaveBeenCalledWith('NBS')
    expect(mockClearPericopeCache).toHaveBeenCalledWith('NBS')
    expect(mockClearRedWordsCache).toHaveBeenCalledWith('NBS')
  })

  it('keeps a side file the archive has just installed', async () => {
    await removeLegacyBibleSideFiles('NBS', ['file:///documents/red-words-NBS.json'])

    expect(mockDeletePericopeFile).toHaveBeenCalledWith('NBS')
    expect(mockDeleteRedWordsFile).not.toHaveBeenCalled()
    expect(mockClearRedWordsCache).toHaveBeenCalledWith('NBS')
  })
})

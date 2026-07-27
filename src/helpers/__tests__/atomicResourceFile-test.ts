/* eslint-disable import/first */
const mockGetInfoAsync = jest.fn()
const mockMoveAsync = jest.fn()

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  moveAsync: (...args: unknown[]) => mockMoveAsync(...args),
}))

import { restoreOrphanedResourceBackup } from '../atomicResourceFile'

describe('atomic resource file recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('restores an orphaned backup when the destination is missing', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true })

    await restoreOrphanedResourceBackup('/resource.sqlite', '/resource.sqlite.backup')

    expect(mockMoveAsync).toHaveBeenCalledWith({
      from: '/resource.sqlite.backup',
      to: '/resource.sqlite',
    })
  })

  it('leaves the backup untouched when the destination exists', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true }).mockResolvedValueOnce({ exists: true })

    await restoreOrphanedResourceBackup('/resource.sqlite', '/resource.sqlite.backup')

    expect(mockMoveAsync).not.toHaveBeenCalled()
  })
})

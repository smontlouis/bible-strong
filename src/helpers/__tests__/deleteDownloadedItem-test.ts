/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    LSG: { id: 'LSG' },
    DBY: { id: 'DBY' },
    DBR: { id: 'DBR' },
    BHG: { id: 'BHG' },
  },
  isStrongVersion: () => false,
}))

jest.mock('../biblesDb', () => ({
  isVersionInstalled: jest.fn(),
  removeBibleVersion: jest.fn(),
}))

jest.mock('~helpers/requireBiblePath', () => ({
  requireBiblePath: jest.fn(),
}))

jest.mock('../sqlite', () => ({
  dbManager: {
    getDB: jest.fn(),
  },
}))

jest.mock('~helpers/redWords', () => ({
  deleteRedWordsFile: jest.fn(),
}))

jest.mock('~helpers/pericopes', () => ({
  deletePericopeFile: jest.fn(),
}))

jest.mock('~helpers/strongBiblePublications', () => ({
  isStrongCapableBibleVersion: (versionId: string) =>
    versionId === 'LSG' || versionId === 'DBY' || versionId === 'DBR',
}))

jest.mock('../strongBibleSidecar', () => ({
  removeStrongBibleSidecar: jest.fn(),
}))

jest.mock('../interlinearBibleSidecar', () => ({
  removeInterlinearSidecar: jest.fn(),
}))

jest.mock('../strongLexiconModules', () => ({
  removeStrongLexiconModule: jest.fn(),
}))

jest.mock('../queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}))

jest.mock('../resourcePublication', () => ({
  resourcePublicationStore: {
    remove: jest.fn(),
  },
}))

import * as FileSystem from 'expo-file-system/legacy'
import { isVersionInstalled, removeBibleVersion } from '../biblesDb'
import { createDownloadedItemDeletionPlan, deleteDownloadedItem } from '../deleteDownloadedItem'
import { dbManager } from '../sqlite'
import { removeStrongBibleSidecar } from '../strongBibleSidecar'
import { removeInterlinearSidecar } from '../interlinearBibleSidecar'
import { removeStrongLexiconModule } from '../strongLexiconModules'

const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync)
const mockIsVersionInstalled = jest.mocked(isVersionInstalled)
const mockRemoveBibleVersion = jest.mocked(removeBibleVersion)
const mockRemoveStrongBibleSidecar = jest.mocked(removeStrongBibleSidecar)
const mockRemoveInterlinearSidecar = jest.mocked(removeInterlinearSidecar)
const mockRemoveStrongLexiconModule = jest.mocked(removeStrongLexiconModule)
const mockGetDatabase = jest.mocked(dbManager.getDB)

describe('deleteDownloadedItem', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsVersionInstalled.mockResolvedValue(true)
    mockGetInfoAsync.mockResolvedValue({
      exists: false,
      uri: 'file:///missing',
      isDirectory: false,
    })
  })

  it('removes the version-specific Strong sidecar when uninstalling its Bible', async () => {
    await deleteDownloadedItem(createDownloadedItemDeletionPlan('bible:DBY'))

    expect(mockRemoveBibleVersion).toHaveBeenCalledWith('DBY')
    expect(mockRemoveStrongBibleSidecar).toHaveBeenCalledWith('DBY')
    expect(mockRemoveStrongBibleSidecar.mock.invocationCallOrder[0]).toBeLessThan(
      mockRemoveBibleVersion.mock.invocationCallOrder[0]!
    )
    expect(mockGetDatabase).not.toHaveBeenCalled()
  })

  it('preserves the Strong sidecar when replacing the default Bible text', async () => {
    await deleteDownloadedItem(
      createDownloadedItemDeletionPlan('bible:LSG', { bibleMode: 'replace' })
    )

    expect(mockRemoveBibleVersion).toHaveBeenCalledWith('LSG')
    expect(mockRemoveStrongBibleSidecar).not.toHaveBeenCalled()
  })

  it('removes a sidecar without removing its Bible', async () => {
    await deleteDownloadedItem(createDownloadedItemDeletionPlan('bible-strong:DBY'))

    expect(mockRemoveStrongBibleSidecar).toHaveBeenCalledWith('DBY')
    expect(mockRemoveBibleVersion).not.toHaveBeenCalled()
  })

  it('removes both localized interlinear indexes before uninstalling BHG', async () => {
    await deleteDownloadedItem(createDownloadedItemDeletionPlan('bible:BHG'))

    expect(mockRemoveInterlinearSidecar).toHaveBeenCalledWith('fr')
    expect(mockRemoveInterlinearSidecar).toHaveBeenCalledWith('en')
    expect(mockRemoveBibleVersion).toHaveBeenCalledWith('BHG')
  })

  it('removes one localized interlinear index without removing BHG', async () => {
    await deleteDownloadedItem(createDownloadedItemDeletionPlan('bible-interlinear:BHG:en'))

    expect(mockRemoveInterlinearSidecar).toHaveBeenCalledWith('en')
    expect(mockRemoveBibleVersion).not.toHaveBeenCalled()
  })

  it('removes a modular Strong lexicon resource', async () => {
    await deleteDownloadedItem(createDownloadedItemDeletionPlan('strong-lexicon:resources'))

    expect(mockRemoveStrongLexiconModule).toHaveBeenCalledWith('resources')
  })

  it('rejects an unknown download item instead of silently reporting success', async () => {
    await expect(
      deleteDownloadedItem(createDownloadedItemDeletionPlan('bible:UNKNOWN'))
    ).rejects.toThrow('UNKNOWN_DOWNLOADED_ITEM:bible:UNKNOWN')
  })
})

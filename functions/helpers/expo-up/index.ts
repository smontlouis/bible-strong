import { uploadAndRollback as initUploadAndRollback } from './modules/uploadAndRollback.js'
import { sendUpdate as initSendUpdate } from './modules/sendUpdate.js'
import { initializeAuthFile as initInitializeAuthFile } from './modules/initializeAuthFile.js'

import {
  defaultAuthFileName,
  defaultRollbackEmbeddedFileName,
  defaultRollbackFileName,
  defaultStorageRootFolder,
} from './constants.js'
import { Request, Response } from 'express'
import { Bucket } from '@google-cloud/storage'

export const ExpoUp = ({
  bucket,
  rollbackEmbeddedFileName = defaultRollbackEmbeddedFileName,
  rollbackFileName = defaultRollbackFileName,
  storageRootFolder = defaultStorageRootFolder,
  authFileName = defaultAuthFileName,
}: {
  bucket: Bucket
  rollbackEmbeddedFileName?: string
  rollbackFileName?: string
  storageRootFolder?: string
  authFileName?: string
}) => {
  return {
    uploadAndRollback: (req: Request, res: Response) =>
      initUploadAndRollback({
        req,
        res,
        bucket,
        storageRootFolder,
        rollbackEmbeddedFileName,
        rollbackFileName,
        authFileName,
      }),
    sendUpdate: (req: Request, res: Response) =>
      initSendUpdate({
        req,
        res,
        bucket,
        storageRootFolder,
        rollbackEmbeddedFileName,
        rollbackFileName,
      }),
    initializeAuthFile: (req: Request, res: Response) =>
      initInitializeAuthFile({
        req,
        res,
        bucket,
        authFileName,
        storageRootFolder,
      }),
  }
}

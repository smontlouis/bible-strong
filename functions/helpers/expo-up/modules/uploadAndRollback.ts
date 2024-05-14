import { Request, Response } from 'express'
import {
  NoPreviousUpdateError,
  UpdateType,
  getListOfBundles,
  getFilesArrayString,
  getLatestBundleString,
  getTypeOfUpdate as initialGetTypeOfUpdate,
  getMetadata,
  UnauthorizedError,
  FirebaseFile,
} from '../helpers.js'
import JSZip from 'jszip'
import { Bucket } from '@google-cloud/storage'

type Params = {
  req: Request
  res: Response
  bucket: Bucket
  storageRootFolder: string
  rollbackEmbeddedFileName: string
  rollbackFileName: string
  authFileName: string
}

export const uploadAndRollback = async (params: Params) => {
  const {
    req,
    res,
    bucket,
    storageRootFolder,
    rollbackEmbeddedFileName,
    rollbackFileName,
  } = params

  try {
    const getTypeOfUpdate = (files: string[]) => {
      return initialGetTypeOfUpdate(files, {
        rollbackEmbeddedFileName,
        rollbackFileName,
      })
    }

    // await checkAuthToken(params)

    const contentType = req.get('content-type')

    // If request is JSON, it's a rollback request
    if (contentType === 'application/json') {
      try {
        const rollbackType: 'embedded' | 'previous' | undefined =
          req.body.rollbackType
        const updatesKey = req.body.updatesKey
        const platform = req.body.platform
        const runtimeVersion = req.body.runtimeVersion

        if (!updatesKey || !platform || !runtimeVersion || !rollbackType) {
          return res.status(400).json({
            error: 'Missing required fields.',
          })
        }

        if (rollbackType !== 'embedded' && rollbackType !== 'previous') {
          return res.status(400).json({
            error: 'Invalid rollback type.',
          })
        }

        const timestamp = new Date().getTime()
        const bucketPrefix = `${storageRootFolder}/${updatesKey}-${platform}/${runtimeVersion}`
        const [result] = await bucket.getFiles({
          prefix: bucketPrefix,
          autoPaginate: false,
        })
        const latestBundleString = getLatestBundleString(result)
        if (!latestBundleString) {
          throw new NoPreviousUpdateError()
        }

        if (rollbackType === 'embedded') {
          return await saveRollbackEmbeddedFile({
            res,
            bucket,
            bucketPrefix,
            timestamp,
            rollbackEmbeddedFileName,
          })
        } else {
          const filesStringArray = getFilesArrayString(
            result,
            `${bucketPrefix}/${latestBundleString}`
          )
          const updateType = getTypeOfUpdate(filesStringArray)

          if (updateType === UpdateType.NORMAL_UPDATE) {
            return await rollbackNormalUpdate({
              res,
              bucket,
              bucketPrefix,
              timestamp,
              rollbackFileName,
              latestBundleString,
              result,
              rollbackEmbeddedFileName,
            })
          } else if (updateType === UpdateType.ROLLBACK) {
            return await rollbackRollbackUpdate({
              res,
              bucket,
              bucketPrefix,
              timestamp,
              rollbackFileName,
              latestBundleString,
              result,
              rollbackEmbeddedFileName,
            })
          } else if (updateType === UpdateType.ROLLBACK_EMBEDDED) {
            return await rollbackRollbackEmbeddedUpdate({
              res,
              bucket,
              bucketPrefix,
              timestamp,
              rollbackFileName,
              rollbackEmbeddedFileName,
              latestBundleString,
              result,
            })
          } else {
            throw Error('Invalid update type.')
          }
        }
      } catch (error) {
        if (error instanceof NoPreviousUpdateError) {
          return res.status(404).json({
            error: 'No previous update available.',
          })
        }
        throw error
      }
    }
    // If request is not JSON, it's an upload request
    else {
      return await uploadFiles(params)
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return res.status(401).json({
        error: 'Unauthorized token. Please check and provide a valid token.',
      })
    }
    console.error(error)
    return res.status(500).json({
      error: 'Internal server error.',
    })
  }
}

const checkAuthToken = async ({
  req,
  bucket,
  storageRootFolder,
  authFileName,
}: Params) => {
  const authorization = req.get('authorization')
  if (!authorization) throw new UnauthorizedError()

  const [_bearer, token] = authorization.split(' ')
  if (!token) throw new UnauthorizedError()

  const authFile = bucket.file(`${storageRootFolder}/${authFileName}`)
  const [authFileDownload] = await authFile.download()
  const authFileContent: string = authFileDownload.toString()
  if (authFileContent !== token) throw new UnauthorizedError()
}

const saveRollbackEmbeddedFile = async ({
  res,
  bucket,
  bucketPrefix,
  timestamp,
  rollbackEmbeddedFileName,
}: {
  res: Response
  bucket: Bucket
  bucketPrefix: string
  timestamp: number
  rollbackEmbeddedFileName: string
}) => {
  const file = bucket.file(
    `${bucketPrefix}/${timestamp}/${rollbackEmbeddedFileName}`
  )
  await file.save(``, {
    contentType: 'text/plain',
  })
  return res.status(201).json({
    message: 'Rollback to embedded successful.',
  })
}

const rollbackNormalUpdate = async ({
  res,
  bucket,
  bucketPrefix,
  timestamp,
  rollbackFileName,
  latestBundleString,
  result,
  rollbackEmbeddedFileName,
}: {
  res: Response
  bucket: Bucket
  bucketPrefix: string
  timestamp: number
  rollbackFileName: string
  latestBundleString: string
  result: FirebaseFile[]
  rollbackEmbeddedFileName: string
}) => {
  const bundles = getListOfBundles(result)
  const previousBundleIndex = bundles.indexOf(latestBundleString) + 1

  if (bundles[previousBundleIndex]) {
    const file = bucket.file(`${bucketPrefix}/${timestamp}/${rollbackFileName}`)
    await file.save(`${bundles[previousBundleIndex]}`, {
      contentType: 'text/plain',
    })
    return res.status(201).json({
      message: 'Rollback to previous update successful.',
    })
  } else {
    const file = bucket.file(
      `${bucketPrefix}/${timestamp}/${rollbackEmbeddedFileName}`
    )
    await file.save(``, {
      contentType: 'text/plain',
    })
    return res.status(201).json({
      message: 'Rollback to embedded update successful.',
    })
  }
}

const rollbackRollbackUpdate = async ({
  res,
  bucket,
  bucketPrefix,
  timestamp,
  rollbackFileName,
  latestBundleString,
  result,
  rollbackEmbeddedFileName,
}: {
  res: Response
  bucket: Bucket
  bucketPrefix: string
  timestamp: number
  rollbackFileName: string
  latestBundleString: string
  result: FirebaseFile[]
  rollbackEmbeddedFileName: string
}) => {
  const getTypeOfUpdate = (files: string[]) => {
    return initialGetTypeOfUpdate(files, {
      rollbackEmbeddedFileName,
      rollbackFileName,
    })
  }

  const bundles = getListOfBundles(result)
  const bundlePrefix = `${bucketPrefix}/${latestBundleString}`
  const rollbackFile = bucket.file(`${bundlePrefix}/${rollbackFileName}`)
  const [rollbackFileDownload] = await rollbackFile.download()
  const rollbackTimestamp = rollbackFileDownload.toString()
  const previousBundleIndex = bundles.indexOf(rollbackTimestamp) + 1

  if (bundles[previousBundleIndex]) {
    for (let i = previousBundleIndex; i < bundles.length; i++) {
      const prevFilesStringArray = getFilesArrayString(
        result,
        `${bucketPrefix}/${bundles[i]}`
      )
      const prevUpdateType = getTypeOfUpdate(prevFilesStringArray)
      if (prevUpdateType === UpdateType.NORMAL_UPDATE) {
        const file = bucket.file(
          `${bucketPrefix}/${timestamp}/${rollbackFileName}`
        )
        await file.save(`${bundles[i]}`, {
          contentType: 'text/plain',
        })
        return res.status(201).json({
          message: 'Rollback to previous update successful.',
        })
      }
    }
  } else {
    const file = bucket.file(
      `${bucketPrefix}/${timestamp}/${rollbackEmbeddedFileName}`
    )
    await file.save(``, {
      contentType: 'text/plain',
    })
    return res.status(201).json({
      message: 'Rollback to embedded successful.',
    })
  }
}

const rollbackRollbackEmbeddedUpdate = async ({
  res,
  bucket,
  bucketPrefix,
  timestamp,
  rollbackFileName,
  rollbackEmbeddedFileName,
  latestBundleString,
  result,
}: {
  res: Response
  bucket: Bucket
  bucketPrefix: string
  timestamp: number
  rollbackFileName: string
  rollbackEmbeddedFileName: string
  latestBundleString: string
  result: FirebaseFile[]
}) => {
  const getTypeOfUpdate = (files: string[]) => {
    return initialGetTypeOfUpdate(files, {
      rollbackEmbeddedFileName,
      rollbackFileName,
    })
  }

  const bundles = getListOfBundles(result)
  const previousBundleIndex = bundles.indexOf(latestBundleString) + 1
  if (bundles[previousBundleIndex]) {
    const prevFilesStringArray = getFilesArrayString(
      result,
      `${bucketPrefix}/${bundles[previousBundleIndex]}`
    )
    const prevUpdateType = getTypeOfUpdate(prevFilesStringArray)
    if (prevUpdateType === UpdateType.NORMAL_UPDATE) {
      if (!bundles[previousBundleIndex + 1]) {
        throw new NoPreviousUpdateError()
      }
      const file = bucket.file(
        `${bucketPrefix}/${timestamp}/${rollbackFileName}`
      )
      await file.save(`${bundles[previousBundleIndex]}`, {
        contentType: 'text/plain',
      })
      return res.status(201).json({
        message: 'Rollback to previous update successful.',
      })
    } else if (prevUpdateType === UpdateType.ROLLBACK) {
      const prevRollbackFile = bucket.file(
        `${bucketPrefix}/${bundles[previousBundleIndex]}/${rollbackFileName}`
      )
      const [prevRollbackFileDownload] = await prevRollbackFile.download()
      const prevRollbackTimestamp = prevRollbackFileDownload.toString()
      const prevPreviousBundleIndex = bundles.indexOf(prevRollbackTimestamp) + 1
      if (bundles[prevPreviousBundleIndex]) {
        for (let j = prevPreviousBundleIndex; j < bundles.length; j++) {
          const prevPrevFilesStringArray = getFilesArrayString(
            result,
            `${bucketPrefix}/${bundles[j]}`
          )
          const prevPrevUpdateType = getTypeOfUpdate(prevPrevFilesStringArray)
          if (prevPrevUpdateType === UpdateType.NORMAL_UPDATE) {
            const file = bucket.file(
              `${bucketPrefix}/${timestamp}/${rollbackFileName}`
            )
            await file.save(`${bundles[j]}`, {
              contentType: 'text/plain',
            })
            return res.status(201).json({
              message: 'Rollback to previous update successful.',
            })
          }
        }
      } else {
        throw new NoPreviousUpdateError()
      }
    } else {
      throw new NoPreviousUpdateError()
    }
  } else {
    throw new NoPreviousUpdateError()
  }
}

const uploadFiles = async ({
  req,
  res,
  bucket,
  storageRootFolder,
  rollbackEmbeddedFileName,
  rollbackFileName,
}: Params) => {
  const getTypeOfUpdate = (files: string[]) => {
    return initialGetTypeOfUpdate(files, {
      rollbackEmbeddedFileName,
      rollbackFileName,
    })
  }

  const file = req.file
  const updatesKey = req.body.updatesKey
  const platform = req.body.platform
  const runtimeVersion = req.body.runtimeVersion
  const bundleTimestamp = req.body.bundleTimestamp

  if (
    !file ||
    !updatesKey ||
    !platform ||
    !runtimeVersion ||
    !bundleTimestamp
  ) {
    return res.status(400).json({
      error: 'Missing required fields.',
    })
  }

  const bucketPrefix = `${storageRootFolder}/${updatesKey}-${platform}/${runtimeVersion}`
  const fileArrayBuffer = typeof file !== 'string' ? file.buffer : null

  if (!fileArrayBuffer) {
    return res.status(400).json({
      error: 'Invalid file.',
    })
  }

  const jszip = new JSZip()
  const zip = await jszip.loadAsync(fileArrayBuffer)
  const zipFiles = Object.keys(zip.files)
    .filter((file) => {
      if (!zip.files[file].dir) {
        return true
      }
      return false
    })
    .map((file) => zip.files[file])

  // get latest update bundle
  const [result] = await bucket.getFiles({
    prefix: bucketPrefix,
    autoPaginate: false,
  })

  if (result.length !== 0) {
    const latestBundleString = getLatestBundleString(result)
    const latestBundlePrefix = `${bucketPrefix}/${latestBundleString}`
    const filesStringArray = getFilesArrayString(
      result,
      `${latestBundlePrefix}`
    )
    const updateType = getTypeOfUpdate(filesStringArray)

    if (updateType === UpdateType.NORMAL_UPDATE) {
      // download metadata file
      const metadataJson = bucket.file(`${latestBundlePrefix}/metadata.json`)
      const [metadataJsonDownload] = await metadataJson.download()
      const [metadataJsonMetadata] = await metadataJson.getMetadata()
      const buffer = metadataJsonDownload
      const latestMetadata = getMetadata({
        buffer,
        createdAt: metadataJsonMetadata.timeCreated ?? new Date().toISOString(),
      })

      const zipNewMetadata = zipFiles.find((file) => {
        if (file.name === 'metadata.json') {
          return true
        }
        return false
      })

      let newMetadata
      if (zipNewMetadata) {
        const arrayBuffer = await zipNewMetadata.async('arraybuffer')
        // convert array buffer to buffer
        const newBuffer = Buffer.from(arrayBuffer)
        newMetadata = getMetadata({
          buffer: newBuffer,
          createdAt: new Date(zipNewMetadata.date).toISOString(),
        })
      }

      if (!newMetadata) {
        return res.status(400).json({
          error: 'Invalid update bundle.',
        })
      }

      if (latestMetadata.id === newMetadata.id) {
        return res.status(200).json({
          message: 'Update already exists.',
        })
      }
    }
  }

  // upload files
  const promises: Promise<boolean>[] = []
  zipFiles.forEach(async (unzippedFile) => {
    promises.push(
      new Promise(async (resolve, reject) => {
        try {
          const arrayBuffer = await unzippedFile.async('arraybuffer')
          const buffer = Buffer.from(arrayBuffer)
          const file = bucket.file(
            `${bucketPrefix}/${bundleTimestamp}/${unzippedFile.name}`
          )
          await file.save(buffer)
          resolve(true)
        } catch (error) {
          reject(error)
        }
      })
    )
  })

  await Promise.all(promises)
  return res.status(201).json({
    message: 'Update uploaded successfully.',
  })
}

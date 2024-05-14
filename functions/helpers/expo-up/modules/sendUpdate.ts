import FormData from 'form-data'

import { putNoUpdateAvailableInResponseAsync } from '../responses.js'
import {
  getFilesArrayString,
  getLatestBundleString,
  getMetadata,
  NoUpdateAvailableError,
  getTypeOfUpdate as initialGetTypeOfUpdate,
  UpdateType,
  convertSHA256HashToUUID,
  getAssetAsync,
  FirebaseFileFunctions,
} from '../helpers.js'
import { Request, Response } from 'express'
import { Bucket } from '@google-cloud/storage'

export const sendUpdate = async ({
  req,
  res,
  bucket,
  storageRootFolder,
  rollbackEmbeddedFileName,
  rollbackFileName,
}: {
  req: Request
  res: Response
  bucket: Bucket
  storageRootFolder: string
  rollbackEmbeddedFileName: string
  rollbackFileName: string
}) => {
  const getTypeOfUpdate = (files: string[]) => {
    return initialGetTypeOfUpdate(files, {
      rollbackEmbeddedFileName,
      rollbackFileName,
    })
  }

  const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`)

  const protocolVersionMaybeArray = req.get('expo-protocol-version')
  if (protocolVersionMaybeArray && Array.isArray(protocolVersionMaybeArray)) {
    return res.status(400).json({
      error: 'Unsupported protocol version. Expected either 0 or 1.',
    })
  }
  const protocolVersion = parseInt(protocolVersionMaybeArray ?? '0', 10)

  const platform = req.get('expo-platform') ?? url.searchParams.get('platform')
  if (platform !== 'ios' && platform !== 'android') {
    return res.status(400).json({
      error: 'Unsupported platform. Expected either ios or android.',
    })
  }

  const runtimeVersion =
    req.get('expo-runtime-version') ?? url.searchParams.get('runtime-version')
  if (!runtimeVersion || typeof runtimeVersion !== 'string') {
    return res.status(400).json({
      error: 'No runtimeVersion provided.',
    })
  }

  const updatesKey = req.get('x-expo-updates-key')
  if (!updatesKey || typeof updatesKey !== 'string') {
    return res.status(400).json({
      error: 'No x-expo-updates-key provided.',
    })
  }

  const currentUpdateId = req.get('expo-current-update-id')

  // create prefix
  const bucketPrefix = `${storageRootFolder}/${updatesKey}-${platform}/${runtimeVersion}`

  const [result] = await bucket.getFiles({
    prefix: bucketPrefix,
    autoPaginate: false,
  })

  if (result.length <= 0) {
    return await putNoUpdateAvailableInResponseAsync(res, protocolVersion)
  }

  // get latest update bundle
  const latestBundleString = getLatestBundleString(result)

  if (!latestBundleString) {
    return await putNoUpdateAvailableInResponseAsync(res, protocolVersion)
  }

  const latestBundlePrefix = `${bucketPrefix}/${latestBundleString}`
  const filesStringArray = getFilesArrayString(result, `${latestBundlePrefix}`)
  const updateType = getTypeOfUpdate(filesStringArray)

  try {
    try {
      if (
        updateType === UpdateType.NORMAL_UPDATE ||
        updateType === UpdateType.ROLLBACK
      ) {
        let updateBundlePrefix = latestBundlePrefix
        if (updateType === UpdateType.ROLLBACK) {
          const rollbackFile = bucket.file(`${updateBundlePrefix}/rollback`)
          const [rollbackDownlaod] = await rollbackFile.download()
          const rollbackBundle = rollbackDownlaod.toString('utf-8')
          updateBundlePrefix = `${bucketPrefix}/${rollbackBundle}`
        }
        const metadataJson = bucket.file(`${updateBundlePrefix}/metadata.json`)
        const [metadataJsonDownload] = await metadataJson.download()
        const [metadataJsonMetadata] = await metadataJson.getMetadata()

        const buffer = metadataJsonDownload
        const latestMetadata = getMetadata({
          buffer,
          createdAt:
            metadataJsonMetadata.timeCreated ?? new Date().toISOString(),
        })

        if (
          currentUpdateId === convertSHA256HashToUUID(latestMetadata.id) &&
          protocolVersion === 1
        )
          throw new NoUpdateAvailableError()

        const expoConfigFile = bucket.file(
          `${updateBundlePrefix}/expoConfig.json`
        )
        const [expoConfigDownload] = await expoConfigFile.download()
        const expoConfigBuffer = expoConfigDownload
        const expoConfigJson = JSON.parse(expoConfigBuffer.toString('utf-8'))

        const platformSpecificMetadata =
          latestMetadata.json.fileMetadata[platform]

        const launchAsset = bucket.file(
          `${updateBundlePrefix}/${platformSpecificMetadata.bundle}`
        ) as FirebaseFileFunctions

        const manifest = {
          id: convertSHA256HashToUUID(latestMetadata.id),
          createdAt: latestMetadata.createdAt,
          runtimeVersion,
          assets: await Promise.all(
            platformSpecificMetadata.assets.map(
              (asset: { path: string; ext: string }) => {
                const assetFile = bucket.file(
                  `${updateBundlePrefix}/${asset.path}`
                ) as FirebaseFileFunctions
                return getAssetAsync({
                  assetFile,
                  ext: asset.ext,
                })
              }
            )
          ),
          launchAsset: await getAssetAsync({
            assetFile: launchAsset,
          }),
          metadata: {},
          extra: {
            expoClient: expoConfigJson,
          },
        }

        const assetRequestHeaders: { [key: string]: object } = {}
        ;[...manifest.assets, manifest.launchAsset].forEach((asset) => {
          assetRequestHeaders[asset.key] = {}
        })

        const form = new FormData()
        form.append('manifest', JSON.stringify(manifest), {
          contentType: 'application/json',
          header: {
            'content-type': 'application/json; charset=utf-8',
          },
        })
        form.append('extensions', JSON.stringify({ assetRequestHeaders }), {
          contentType: 'application/json',
        })

        res.set('expo-protocol-version', `${protocolVersion}`)
        res.set('expo-sfv-version', '0')
        res.set('cache-control', 'private, max-age=0')
        res.set(
          'content-type',
          `multipart/mixed; boundary=${form.getBoundary()}`
        )

        return res.status(200).send(form.getBuffer())
      } else if (updateType === UpdateType.ROLLBACK_EMBEDDED) {
        if (protocolVersion === 0) {
          throw new Error('Rollbacks not supported on protocol version 0')
        }

        const embeddedUpdateId = req.get('expo-embedded-update-id')
        if (!embeddedUpdateId || typeof embeddedUpdateId !== 'string') {
          throw new Error(
            'Invalid Expo-Embedded-Update-ID request header specified.'
          )
        }

        const currentUpdateId = req.get('expo-current-update-id')
        if (currentUpdateId === embeddedUpdateId) {
          throw new NoUpdateAvailableError()
        }

        const rollbackFile = bucket.file(`${latestBundlePrefix}/rollback`)
        const [rollbackMetadata] = await rollbackFile.getMetadata()

        const directive = {
          type: 'rollBackToEmbedded',
          parameters: {
            commitTime: rollbackMetadata.timeCreated,
          },
        }

        const form = new FormData()
        form.append('directive', JSON.stringify(directive), {
          contentType: 'application/json',
          header: {
            'content-type': 'application/json; charset=utf-8',
          },
        })

        res.set('expo-protocol-version', `${protocolVersion}`)
        res.set('expo-sfv-version', '0')
        res.set('cache-control', 'private, max-age=0')
        res.set(
          'content-type',
          `multipart/mixed; boundary=${form.getBoundary()}`
        )

        return res.status(200).send(form.getBuffer())
      } else {
        throw new Error('Invalid update type.')
      }
    } catch (maybeNoUpdateAvailableError) {
      if (maybeNoUpdateAvailableError instanceof NoUpdateAvailableError) {
        return await putNoUpdateAvailableInResponseAsync(res, protocolVersion)
      }
      throw maybeNoUpdateAvailableError
    }
  } catch (error) {
    console.error(error)
    return res.status(400).json({
      error,
    })
  }
}

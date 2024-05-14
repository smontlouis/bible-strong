import crypto, { HexBase64Latin1Encoding } from 'crypto'
import mime from 'mime-types'

export interface FirebaseFile {
  name: string
}

export class NoUpdateAvailableError extends Error {}
export class NoPreviousUpdateError extends Error {}
export class UnauthorizedError extends Error {}

export interface FirebaseFileFunctions {
  download: () => Promise<Buffer[]>
  getSignedUrl: (options: {
    action: string
    expires: number
  }) => Promise<string[]>
}

export const getLatestBundleString = (files: FirebaseFile[]) => {
  const bundles = files
    .map((file) => {
      const name = file.name.split('/')
      const timestamp = name[3]
      return timestamp
    })
    .filter((file) => file)
    // remove duplicates
    .filter((value, index, self) => self.indexOf(value) === index)
  const latestBundle = bundles.sort(
    (a, b) => parseInt(b, 10) - parseInt(a, 10)
  )[0]

  return latestBundle
}

export const getListOfBundles = (files: FirebaseFile[]) => {
  const bundles = files
    .map((file) => {
      const name = file.name.split('/')
      const timestamp = name[3]
      return timestamp
    })
    .filter((file) => file)
    // remove duplicates
    .filter((value, index, self) => self.indexOf(value) === index)

  // sort in descending order
  return bundles.sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
}

export const getFilesArrayString = (files: FirebaseFile[], prefix: string) => {
  const filteredFiles = files
    .filter((file) => file.name.startsWith(`${prefix}`))
    .filter((file) => !file.name.endsWith('/'))
    .map((file) => file.name.split(`${prefix}/`).pop() as string)

  return filteredFiles
}

export enum UpdateType {
  NORMAL_UPDATE,
  ROLLBACK,
  ROLLBACK_EMBEDDED,
}

export const getTypeOfUpdate = (
  files: string[],
  fileNames: {
    rollbackEmbeddedFileName: string
    rollbackFileName: string
  }
) => {
  if (files.length > 0) {
    if (files.includes(fileNames.rollbackEmbeddedFileName)) {
      return UpdateType.ROLLBACK_EMBEDDED
    } else if (files.includes(fileNames.rollbackFileName)) {
      return UpdateType.ROLLBACK
    } else {
      return UpdateType.NORMAL_UPDATE
    }
  } else {
    return undefined
  }
}

export const getMetadata = ({
  buffer,
  createdAt,
}: {
  buffer: Buffer
  createdAt: string
}) => {
  try {
    const json = JSON.parse(buffer.toString('utf-8'))
    return {
      json,
      createdAt: createdAt,
      id: createHash(buffer, 'sha256', 'hex'),
    }
  } catch (error) {
    throw new Error(`Error on Parsing Metadata Buffer. Error: ${error}`)
  }
}

export const createHash = (
  file: Buffer,
  hashingAlgorithm: string,
  encoding: HexBase64Latin1Encoding
) => {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding)
}

export const convertSHA256HashToUUID = (value: string) => {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(
    12,
    16
  )}-${value.slice(16, 20)}-${value.slice(20, 32)}`
}

export const getAssetAsync = async ({
  assetFile,
  ext,
}: {
  assetFile: FirebaseFileFunctions
  ext?: string
}) => {
  const [download] = await assetFile.download()
  const [url] = await assetFile.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  })
  const assetHash = getBase64URLEncoding(
    createHash(download, 'sha256', 'base64')
  )
  const key = createHash(download, 'md5', 'hex')
  const keyExtensionSuffix = ext ? ext : 'bundle'
  const contentType = ext ? mime.lookup(ext) : 'application/javascript'

  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url,
  }
}

export const getBase64URLEncoding = (base64EncodedString: string) => {
  return base64EncodedString
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export const generateToken = (length: number = 16) => {
  return crypto.randomBytes(length).toString('hex')
}

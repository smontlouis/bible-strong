import RNFetchBlob from 'rn-fetch-blob'

export const toNativeFilePath = (uri: string): string => uri.replace(/^file:\/\//u, '')

export const getFileSha256 = (fileUri: string): Promise<string> =>
  RNFetchBlob.fs.hash(toNativeFilePath(fileUri), 'sha256')

export const verifyFileSha256 = async (
  fileUri: string,
  expected: string,
  errorCode: string
): Promise<void> => {
  const actual = await getFileSha256(fileUri)
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(errorCode)
  }
}

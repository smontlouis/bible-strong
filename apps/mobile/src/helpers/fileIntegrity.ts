export const toNativeFilePath = (uri: string): string => uri.replace(/^file:\/\//u, '')

export const getFileSha256 = async (fileUri: string): Promise<string> => {
  const { default: RNFetchBlob } = await import('rn-fetch-blob')
  return RNFetchBlob.fs.hash(toNativeFilePath(fileUri), 'sha256')
}

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

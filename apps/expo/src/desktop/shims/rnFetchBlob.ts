/**
 * The part of `rn-fetch-blob` the desktop app reaches: the SHA-256 of an Offline-copy archive
 * (`fileIntegrity.ts`). Metro substitutes it for the package in the desktop build only.
 */
import { call, toFileUri } from '../call'

const fs = {
  async hash(path: string, algorithm: string): Promise<string> {
    if (algorithm !== 'sha256') {
      throw new Error(`rn-fetch-blob hash ${algorithm} is not available in the desktop app`)
    }
    return call<string>('fs_sha256', { uri: toFileUri(path) })
  },
}

const RNFetchBlob = { fs }

export default RNFetchBlob

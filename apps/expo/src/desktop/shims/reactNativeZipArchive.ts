/**
 * The part of `react-native-zip-archive` the desktop app reaches: extracting a plain
 * Offline-copy archive (`offlineArchiveSource.ts`). Metro substitutes it for the package in the
 * desktop build only. Entry names are UTF-8, so the charset argument is accepted and ignored.
 */
import { call, toFileUri } from '../call'

export async function unzip(source: string, target: string, _charset?: string): Promise<string> {
  await call('archive_unzip', { source: toFileUri(source), destination: toFileUri(target) })
  return target
}

export async function zip(): Promise<string> {
  throw new Error('react-native-zip-archive zip is not available in the desktop app')
}

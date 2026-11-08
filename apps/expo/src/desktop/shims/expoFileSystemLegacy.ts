/**
 * `expo-file-system/legacy` for the desktop app, over the shell's commands
 * (`apps/desktop/src-tauri/src/files.rs`, `download.rs`). Metro substitutes it for the package
 * in the desktop build only. It keeps the package's contract where the Offline-copy pipeline
 * relies on it: `getInfoAsync` never throws for a missing file, a non-2xx download resolves with
 * its status, and a cancelled download resolves to `undefined`.
 */
import type * as ExpoFileSystem from 'expo-file-system/legacy'

import { Channel, desktopBootstrap } from '../bridge'
import { call, toFileUri } from '../call'

type FileInfo = ExpoFileSystem.FileInfo
type DownloadOptions = ExpoFileSystem.DownloadOptions
type DownloadProgressCallback = ExpoFileSystem.DownloadProgressCallback
type FileSystemDownloadResult = ExpoFileSystem.FileSystemDownloadResult
type DownloadPauseState = ExpoFileSystem.DownloadPauseState

export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const
export const FileSystemSessionType = { BACKGROUND: 0, FOREGROUND: 1 } as const

export const documentDirectory: string | null = desktopBootstrap().documentDirectory
export const cacheDirectory: string | null = desktopBootstrap().cacheDirectory
export const bundleDirectory: string | null = null

type NativeInfo = {
  exists: boolean
  isDirectory: boolean
  uri: string
  size?: number | null
  modificationTime?: number | null
}

export async function getInfoAsync(fileUri: string): Promise<FileInfo> {
  const info = await call<NativeInfo>('fs_info', { uri: toFileUri(fileUri) })
  if (!info.exists) return { exists: false, isDirectory: false, uri: fileUri }
  return {
    exists: true,
    isDirectory: info.isDirectory,
    uri: info.uri,
    size: info.size ?? 0,
    modificationTime: info.modificationTime ?? 0,
  }
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

export async function readAsStringAsync(
  fileUri: string,
  options: ExpoFileSystem.ReadingOptions = {}
): Promise<string> {
  const buffer = await call<ArrayBuffer>('fs_read_bytes', { uri: toFileUri(fileUri) })
  let bytes = new Uint8Array(buffer)
  if (options.position != null || options.length != null) {
    const start = options.position ?? 0
    bytes = bytes.subarray(start, options.length != null ? start + options.length : undefined)
  }
  return options.encoding === 'base64' ? bytesToBase64(bytes) : new TextDecoder().decode(bytes)
}

export async function writeAsStringAsync(
  fileUri: string,
  contents: string,
  options: ExpoFileSystem.WritingOptions = {}
): Promise<void> {
  await call('fs_write_string', {
    uri: toFileUri(fileUri),
    contents,
    encoding: options.encoding === 'base64' ? 'base64' : 'utf8',
  })
}

export async function deleteAsync(
  fileUri: string,
  options: ExpoFileSystem.DeletingOptions = {}
): Promise<void> {
  await call('fs_delete', { uri: toFileUri(fileUri), idempotent: options.idempotent ?? false })
}

export async function moveAsync({ from, to }: ExpoFileSystem.RelocatingOptions): Promise<void> {
  await call('fs_move', { from: toFileUri(from), to: toFileUri(to) })
}

export async function copyAsync({ from, to }: ExpoFileSystem.RelocatingOptions): Promise<void> {
  await call('fs_copy', { from: toFileUri(from), to: toFileUri(to) })
}

export async function makeDirectoryAsync(
  fileUri: string,
  options: ExpoFileSystem.MakeDirectoryOptions = {}
): Promise<void> {
  await call('fs_mkdir', { uri: toFileUri(fileUri), intermediates: options.intermediates ?? false })
}

export async function readDirectoryAsync(fileUri: string): Promise<string[]> {
  return call<string[]>('fs_read_dir', { uri: toFileUri(fileUri) })
}

const diskSpace = () =>
  call<{ free: number; total: number }>('fs_disk_space', {
    uri: desktopBootstrap().documentDirectory,
  })

export async function getFreeDiskStorageAsync(): Promise<number> {
  return (await diskSpace()).free
}

export async function getTotalDiskCapacityAsync(): Promise<number> {
  return (await diskSpace()).total
}

export async function getContentUriAsync(fileUri: string): Promise<string> {
  return fileUri
}

let nextDownloadId = 0

type NativeDownloadResult = {
  uri: string
  status: number
  headers: Record<string, string>
  mimeType: string | null
}

export class DownloadResumable {
  private readonly id = `download-${Date.now()}-${++nextDownloadId}`
  private cancelled = false

  constructor(
    private readonly url: string,
    private readonly fileUri: string,
    private readonly options: DownloadOptions = {},
    private readonly callback?: DownloadProgressCallback
  ) {}

  async downloadAsync(): Promise<FileSystemDownloadResult | undefined> {
    if (this.cancelled) return undefined
    const onProgress = new Channel<{
      totalBytesWritten: number
      totalBytesExpectedToWrite: number
    }>()
    onProgress.onmessage = progress => this.callback?.(progress)
    const result = await call<NativeDownloadResult | null>('download_start', {
      id: this.id,
      url: this.url,
      uri: toFileUri(this.fileUri),
      headers: this.options.headers ?? {},
      onProgress,
    })
    if (!result) return undefined
    return {
      uri: result.uri,
      status: result.status,
      headers: result.headers,
      mimeType: result.mimeType,
    }
  }

  /** Stops the transfer; the desktop shell does not resume, so the result has no resume data. */
  async pauseAsync(): Promise<DownloadPauseState> {
    await this.stop()
    return { url: this.url, fileUri: this.fileUri, options: this.options }
  }

  async resumeAsync(): Promise<FileSystemDownloadResult | undefined> {
    this.cancelled = false
    return this.downloadAsync()
  }

  async cancelAsync(): Promise<void> {
    await this.stop()
  }

  savable(): DownloadPauseState {
    return { url: this.url, fileUri: this.fileUri, options: this.options }
  }

  private async stop() {
    this.cancelled = true
    await call('download_cancel', { id: this.id })
  }
}

export function createDownloadResumable(
  uri: string,
  fileUri: string,
  options?: DownloadOptions,
  callback?: DownloadProgressCallback
): DownloadResumable {
  return new DownloadResumable(uri, fileUri, options, callback)
}

export async function downloadAsync(
  uri: string,
  fileUri: string,
  options?: DownloadOptions
): Promise<FileSystemDownloadResult> {
  const result = await createDownloadResumable(uri, fileUri, options).downloadAsync()
  if (!result) throw new Error('The download was cancelled')
  return result
}

const unsupported = (name: string) => async () => {
  throw new Error(`FileSystem.${name} is not available in the desktop app`)
}

export const uploadAsync = unsupported('uploadAsync')
export const createUploadTask = () => {
  throw new Error('FileSystem.createUploadTask is not available in the desktop app')
}
export const deleteLegacyDocumentDirectoryAndroid = async () => undefined
export const StorageAccessFramework = undefined

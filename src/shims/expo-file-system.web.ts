// Web shim for expo-file-system
// Uses IndexedDB for persistent file storage on web

const DB_NAME = 'expo-file-system'
const STORE_NAME = 'files'
const DB_VERSION = 1

// Virtual document directory for web
export const documentDirectory = 'file:///document/'
export const cacheDirectory = 'file:///cache/'
export const bundleDirectory = 'file:///bundle/'

// IndexedDB helpers
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'path' })
      }
    }
  })
}

const getStore = async (mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> => {
  const db = await openDB()
  const transaction = db.transaction(STORE_NAME, mode)
  return transaction.objectStore(STORE_NAME)
}

// Normalize path to ensure consistency
const normalizePath = (path: string): string => {
  // Remove trailing slashes and normalize
  return path.replace(/\/+$/, '')
}

// File info type
interface FileInfo {
  exists: boolean
  uri: string
  size?: number
  isDirectory?: boolean
  modificationTime?: number
}

// Download progress callback type
type DownloadProgressCallback = (data: {
  totalBytesWritten: number
  totalBytesExpectedToWrite: number
}) => void

// Get info about a file or directory
export const getInfoAsync = async (
  fileUri: string,
  _options?: { size?: boolean }
): Promise<FileInfo> => {
  try {
    const store = await getStore('readonly')
    const path = normalizePath(fileUri)

    return new Promise(resolve => {
      const request = store.get(path)

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            exists: true,
            uri: path,
            size: request.result.content?.length || 0,
            isDirectory: request.result.isDirectory || false,
            modificationTime: request.result.modificationTime || Date.now(),
          })
        } else {
          resolve({
            exists: false,
            uri: path,
            isDirectory: false,
          })
        }
      }

      request.onerror = () => {
        resolve({
          exists: false,
          uri: path,
          isDirectory: false,
        })
      }
    })
  } catch {
    return {
      exists: false,
      uri: fileUri,
      isDirectory: false,
    }
  }
}

// Check if a URI is a bundled asset URL (from expo-asset on web)
const isAssetUrl = (uri: string): boolean => {
  return uri.startsWith('/assets/') || uri.startsWith('http://') || uri.startsWith('https://')
}

// Read file as string
export const readAsStringAsync = async (
  fileUri: string,
  _options?: { encoding?: string }
): Promise<string> => {
  // Handle bundled assets (from expo-asset on web)
  if (isAssetUrl(fileUri)) {
    try {
      const response = await fetch(fileUri)
      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${response.status}`)
      }
      return await response.text()
    } catch (e) {
      throw new Error(`Failed to read asset: ${fileUri} - ${e}`)
    }
  }

  // Handle files stored in IndexedDB
  const store = await getStore('readonly')
  const path = normalizePath(fileUri)

  return new Promise((resolve, reject) => {
    const request = store.get(path)

    request.onsuccess = () => {
      if (request.result && request.result.content) {
        resolve(request.result.content)
      } else {
        reject(new Error(`File not found: ${path}`))
      }
    }

    request.onerror = () => {
      reject(new Error(`Failed to read file: ${path}`))
    }
  })
}

// Write string to file
export const writeAsStringAsync = async (
  fileUri: string,
  contents: string,
  _options?: { encoding?: string }
): Promise<void> => {
  const store = await getStore('readwrite')
  const path = normalizePath(fileUri)

  return new Promise((resolve, reject) => {
    const request = store.put({
      path,
      content: contents,
      isDirectory: false,
      modificationTime: Date.now(),
    })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error(`Failed to write file: ${path}`))
  })
}

// Delete file or directory
export const deleteAsync = async (
  fileUri: string,
  options?: { idempotent?: boolean }
): Promise<void> => {
  try {
    const store = await getStore('readwrite')
    const path = normalizePath(fileUri)

    return new Promise((resolve, reject) => {
      const request = store.delete(path)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        if (options?.idempotent) {
          resolve()
        } else {
          reject(new Error(`Failed to delete: ${path}`))
        }
      }
    })
  } catch (e) {
    if (!options?.idempotent) {
      throw e
    }
  }
}

// Create directory
export const makeDirectoryAsync = async (
  fileUri: string,
  _options?: { intermediates?: boolean }
): Promise<void> => {
  const store = await getStore('readwrite')
  const path = normalizePath(fileUri)

  return new Promise((resolve, reject) => {
    const request = store.put({
      path,
      content: null,
      isDirectory: true,
      modificationTime: Date.now(),
    })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error(`Failed to create directory: ${path}`))
  })
}

// Move file
export const moveAsync = async (options: { from: string; to: string }): Promise<void> => {
  const { from, to } = options

  // Read the source file
  const content = await readAsStringAsync(from)

  // Write to destination
  await writeAsStringAsync(to, content)

  // Delete source
  await deleteAsync(from)
}

// Copy file
export const copyAsync = async (options: { from: string; to: string }): Promise<void> => {
  const { from, to } = options

  // Read the source file
  const content = await readAsStringAsync(from)

  // Write to destination
  await writeAsStringAsync(to, content)
}

// Download file from URL (simple version)
export const downloadAsync = async (
  uri: string,
  fileUri: string,
  options?: { headers?: Record<string, string> }
): Promise<{ uri: string; status: number; headers: Record<string, string> }> => {
  try {
    const response = await fetch(uri, {
      headers: options?.headers,
    })

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`)
    }

    const content = await response.text()
    await writeAsStringAsync(fileUri, content)

    // Convert headers to object
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    return {
      uri: fileUri,
      status: response.status,
      headers,
    }
  } catch (e) {
    throw new Error(`Download failed: ${e}`)
  }
}

// Create a resumable download (web implementation uses fetch with progress)
export const createDownloadResumable = (
  uri: string,
  fileUri: string,
  _options?: Record<string, unknown>,
  callback?: DownloadProgressCallback
) => {
  return {
    downloadAsync: async (): Promise<{ uri: string; status: number }> => {
      try {
        const response = await fetch(uri)

        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`)
        }

        const contentLength = response.headers.get('content-length')
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

        // If we have a callback and the browser supports ReadableStream
        if (callback && response.body) {
          const reader = response.body.getReader()
          const chunks: Uint8Array[] = []
          let receivedLength = 0

          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              break
            }

            chunks.push(value)
            receivedLength += value.length

            // Call progress callback
            callback({
              totalBytesWritten: receivedLength,
              totalBytesExpectedToWrite: totalBytes || receivedLength,
            })
          }

          // Combine chunks and convert to string
          const chunksAll = new Uint8Array(receivedLength)
          let position = 0
          for (const chunk of chunks) {
            chunksAll.set(chunk, position)
            position += chunk.length
          }

          const content = new TextDecoder('utf-8').decode(chunksAll)
          await writeAsStringAsync(fileUri, content)
        } else {
          // Fallback: no progress tracking
          const content = await response.text()
          await writeAsStringAsync(fileUri, content)

          if (callback) {
            callback({
              totalBytesWritten: content.length,
              totalBytesExpectedToWrite: content.length,
            })
          }
        }

        return {
          uri: fileUri,
          status: response.status,
        }
      } catch (e) {
        throw new Error(`Download failed: ${e}`)
      }
    },
    pauseAsync: async () => {
      console.warn('[FileSystem] pauseAsync is not fully supported on web')
    },
    resumeAsync: async () => {
      console.warn('[FileSystem] resumeAsync is not fully supported on web')
    },
    savable: () => ({
      url: uri,
      fileUri,
    }),
  }
}

// Read directory contents
export const readDirectoryAsync = async (fileUri: string): Promise<string[]> => {
  const store = await getStore('readonly')
  const path = normalizePath(fileUri)

  return new Promise((resolve, reject) => {
    const files: string[] = []
    const request = store.openCursor()

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        const filePath = cursor.value.path as string
        if (filePath.startsWith(path + '/')) {
          // Get the relative path
          const relativePath = filePath.substring(path.length + 1)
          // Only include direct children (no nested paths)
          if (!relativePath.includes('/')) {
            files.push(relativePath)
          }
        }
        cursor.continue()
      } else {
        resolve(files)
      }
    }

    request.onerror = () => {
      reject(new Error(`Failed to read directory: ${path}`))
    }
  })
}

// Encoding types
export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const

// File system constants
export const FileSystemUploadType = {
  BINARY_CONTENT: 0,
  MULTIPART: 1,
} as const

export const FileSystemSessionType = {
  BACKGROUND: 0,
  FOREGROUND: 1,
} as const

// Default export for compatibility
export default {
  documentDirectory,
  cacheDirectory,
  bundleDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  makeDirectoryAsync,
  moveAsync,
  copyAsync,
  downloadAsync,
  createDownloadResumable,
  readDirectoryAsync,
  EncodingType,
  FileSystemUploadType,
  FileSystemSessionType,
}

import { invoke } from './bridge'

/** Native commands reject with a message string; the app's handlers read `error.message`. */
export const call = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }
}

/**
 * The shell speaks `file://` URIs. `toNativeFilePath` strips the scheme before the archive and
 * hash helpers, which leaves `/Users/…` or, on Windows, `/C:/Users/…`: both get it back.
 */
export const toFileUri = (value: string): string => {
  if (value.startsWith('file:')) return value
  if (value.startsWith('/')) return `file://${value}`
  if (/^[A-Za-z]:[\\/]/.test(value)) return `file:///${value.replace(/\\/g, '/')}`
  throw new Error(`Expected an absolute path or a file URI: ${value}`)
}

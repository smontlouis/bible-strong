import * as FileSystem from 'expo-file-system/legacy'
import { getFileSha256 } from '~helpers/fileIntegrity'
import { getDailyCollectionUri } from './dailyReadingFormat'

/**
 * The collections this device keeps, one file each, named by collection and hash
 * (`<documents>/daily-readings/<id>.<hash>.json`). A new file replaces the old one only once its
 * bytes match the catalog's hash, so an interrupted download never passes for the current one.
 */
const directory = () => `${FileSystem.documentDirectory ?? ''}daily-readings/`
const fileName = (id: string, hash: string) => `${encodeURIComponent(id)}.${hash}.json`
const hashOf = (name: string, id: string) => {
  const prefix = `${encodeURIComponent(id)}.`
  const match = name.startsWith(prefix)
    ? /^([0-9a-f]{12})\.json$/.exec(name.slice(prefix.length))
    : null
  return match?.[1]
}

const keptNames = async (id: string) => {
  const info = await FileSystem.getInfoAsync(directory())
  if (!info.exists) return []
  return (await FileSystem.readDirectoryAsync(directory())).filter(name => hashOf(name, id))
}

export type KeptCollection = { hash: string; text: string }

/** The copy kept on this device, if any. */
export const readKeptCollection = async (id: string): Promise<KeptCollection | undefined> => {
  const [name] = await keptNames(id)
  const hash = name && hashOf(name, id)
  if (!name || !hash) return undefined
  try {
    return { hash, text: await FileSystem.readAsStringAsync(directory() + name) }
  } catch {
    return undefined
  }
}

/** Downloads the file of `hash`, checks it, keeps it in place of the older copies. */
export const downloadCollection = async (id: string, hash: string): Promise<string> => {
  await FileSystem.makeDirectoryAsync(directory(), { intermediates: true })
  const partial = `${directory()}${fileName(id, hash)}.partial`
  const final = directory() + fileName(id, hash)
  try {
    const result = await FileSystem.downloadAsync(getDailyCollectionUri(id, hash), partial)
    if (result.status !== 200) throw new Error(`DAILY_READING_DOWNLOAD_${result.status}`)
    const sha256 = await getFileSha256(partial)
    if (!sha256.toLowerCase().startsWith(hash)) throw new Error('DAILY_READING_INTEGRITY')
    await FileSystem.deleteAsync(final, { idempotent: true })
    await FileSystem.moveAsync({ from: partial, to: final })
  } catch (error) {
    await FileSystem.deleteAsync(partial, { idempotent: true })
    throw error
  }
  for (const name of await keptNames(id)) {
    if (name !== fileName(id, hash))
      await FileSystem.deleteAsync(directory() + name, { idempotent: true })
  }
  return FileSystem.readAsStringAsync(final)
}

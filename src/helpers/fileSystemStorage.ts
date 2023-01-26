import to from 'await-to-js'
import * as FileSystem from 'expo-file-system'

const storagePath = `${FileSystem.documentDirectory}/persistAtoms`
const createStoragePathIfNeeded = async () => {
  const info = await FileSystem.getInfoAsync(storagePath)

  return info.exists
    ? Promise.resolve()
    : FileSystem.makeDirectoryAsync(storagePath, {
        intermediates: true,
      })
}

const toFileName = (name: string) => name.split(':').join('-')
const pathForKey = (key: string) => `${storagePath}/${toFileName(key)}`

const fileSystemStorage = {
  setItem: async (key: string, value: string) => {
    await createStoragePathIfNeeded()
    await FileSystem.writeAsStringAsync(pathForKey(key), value, {
      encoding: 'utf8',
    })
  },
  getItem: async (key: string) => {
    await createStoragePathIfNeeded()
    const [err, value] = await to(
      FileSystem.readAsStringAsync(pathForKey(key), {
        encoding: 'utf8',
      })
    )

    if (err || !value) {
      return null
    }

    return value
  },

  removeItem: async (key: string) => {
    const info = await FileSystem.getInfoAsync(pathForKey(key))
    if (!info.exists) return

    return await FileSystem.deleteAsync(pathForKey(key), {
      idempotent: true,
    })
  },
}

export default fileSystemStorage

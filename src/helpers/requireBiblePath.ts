import * as FileSystem from 'expo-file-system'

export const requireBiblePath = (id: string) => {
  if (id === 'INT') {
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    return `${sqliteDirPath}/interlineaire.sqlite`
  }

  return `${FileSystem.documentDirectory}bible-${id}.json`
}

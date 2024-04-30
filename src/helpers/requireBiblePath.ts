import * as FileSystem from 'expo-file-system'
import { databaseInterlineaireName } from './sqlite'

export const requireBiblePath = (id: string) => {
  if (id === 'INT') {
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    return `${sqliteDirPath}/${databaseInterlineaireName}`
  }

  return `${FileSystem.documentDirectory}bible-${id}.json`
}

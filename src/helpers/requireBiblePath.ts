import * as FileSystem from 'expo-file-system/legacy'
import { getDbPath } from './databases'

export const requireBiblePath = (id: string) => {
  if (id === 'INT') {
    return getDbPath('INTERLINEAIRE', 'fr')
  }

  if (id === 'INT_EN') {
    return getDbPath('INTERLINEAIRE', 'en')
  }

  return `${FileSystem.documentDirectory}bible-${id}.json`
}

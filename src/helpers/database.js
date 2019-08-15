import { SQLite } from 'expo-sqlite'

let dbStrong

export const initDB = () => {
  dbStrong = SQLite.openDatabase('strong.sqlite')
  return dbStrong
}

export const getStrongDB = () => {
  return dbStrong
}

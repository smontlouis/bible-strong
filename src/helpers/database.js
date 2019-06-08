import { SQLite } from 'expo-sqlite'

let db

export const initDB = () => {
  db = SQLite.openDatabase('strong.sqlite')
  return db
}

export const getDB = () => {
  return db
}

import { SQLite } from 'expo'

let db

export const initDB = () => {
  db = SQLite.openDatabase('strong.sqlite')
  return db
}

export const getDB = () => {
  return db
}

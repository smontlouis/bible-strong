import { SQLite } from 'expo'

let db

export const initDB = () => {
  db = SQLite.openDatabase('strong.sqlite')
}

export default function getDB () {
  return db
}

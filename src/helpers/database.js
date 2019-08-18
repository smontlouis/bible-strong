import { SQLite } from 'expo-sqlite'

let dbStrong
let dbDictionnaire

export const initStrongDB = () => {
  dbStrong = SQLite.openDatabase('strong.sqlite')
  return dbStrong
}

export const initDictionnaireDB = () => {
  dbStrong = SQLite.openDatabase('dictionnaire.sqlite')
  return dbStrong
}

export const getStrongDB = () => {
  return dbStrong
}

export const getDictionnaireDB = () => {
  return dbDictionnaire
}

import { SQLite } from 'expo-sqlite'

let dbStrong
let dbDictionnaire

export const initStrongDB = () => {
  dbStrong = SQLite.openDatabase('strong.sqlite')
  return dbStrong
}

export const initDictionnaireDB = () => {
  dbDictionnaire = SQLite.openDatabase('dictionnaire.sqlite')
  return dbDictionnaire
}

export const getStrongDB = () => {
  return dbStrong
}

export const getDictionnaireDB = () => {
  return dbDictionnaire
}

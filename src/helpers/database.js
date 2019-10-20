import * as SQLite from 'expo-sqlite'

let dbStrong
let dbDictionnaire
let dbInterlineaire

export const initStrongDB = () => {
  dbStrong = SQLite.openDatabase('strong.sqlite')
  return dbStrong
}

export const initDictionnaireDB = () => {
  dbDictionnaire = SQLite.openDatabase('dictionnaire.sqlite')
  return dbDictionnaire
}

export const initInterlineaireDB = () => {
  dbInterlineaire = SQLite.openDatabase('interlineaire.sqlite')
  return dbDictionnaire
}

export const getStrongDB = () => {
  return dbStrong
}

export const getDictionnaireDB = () => {
  return dbDictionnaire
}

export const getInterlineaireDB = () => {
  return dbInterlineaire
}

export const deleteStrongDB = () => {
  dbStrong = undefined
}

export const deleteDictionnaireDB = () => {
  dbDictionnaire = undefined
}

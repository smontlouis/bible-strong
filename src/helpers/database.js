import * as SQLite from 'expo-sqlite'
import * as FileSystem from 'expo-file-system'

export const getIfDatabaseExists = async sqliteFile => {
  const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
  const dbPath = `${sqliteDirPath}/${sqliteFile}.sqlite`
  const dbFile = await FileSystem.getInfoAsync(dbPath)

  if (dbFile.exists) {
    return true
  }

  return false
}

let dbDictionnaire
let dbInterlineaire
let dbTresorCommentaires

class StrongDB {
  dbStrong

  init = () => {
    this.dbStrong = SQLite.openDatabase('strong.sqlite')
    return this.dbStrong
  }

  get = () => {
    return this.dbStrong
  }

  delete = () => {
    this.dbStrong = undefined
  }
}

export const strongDB = new StrongDB()

export const initDictionnaireDB = () => {
  dbDictionnaire = SQLite.openDatabase('dictionnaire.sqlite')
  return dbDictionnaire
}

export const initInterlineaireDB = () => {
  dbInterlineaire = SQLite.openDatabase('interlineaire.sqlite')
  return dbDictionnaire
}

export const initTresorDB = () => {
  dbTresorCommentaires = SQLite.openDatabase('commentaires-tresor.sqlite')
  return dbTresorCommentaires
}

export const getDictionnaireDB = () => {
  return dbDictionnaire
}

export const getInterlineaireDB = () => {
  return dbInterlineaire
}

export const getTresorDB = () => {
  return dbTresorCommentaires
}

export const deleteDictionnaireDB = () => {
  dbDictionnaire = undefined
}

export const deleteTresorDB = () => {
  dbTresorCommentaires = undefined
}

class MhyDB {
  dbMhy

  init = () => {
    this.dbMhy = SQLite.openDatabase('commentaires-mhy.sqlite')
    return this.dbMhy
  }

  get = () => {
    return this.dbMhy
  }

  delete = () => {
    this.dbMhy = undefined
  }
}

export const mhyDB = new MhyDB()

class NaveDB {
  dbNave

  init = () => {
    this.dbNave = SQLite.openDatabase('nave-fr.sqlite')
    return this.dbNave
  }

  get = () => {
    return this.dbNave
  }

  delete = () => {
    this.dbNave = undefined
  }
}

export const naveDB = new NaveDB()

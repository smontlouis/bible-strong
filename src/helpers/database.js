import SQLite from 'react-native-sqlite-storage'

const RNFS = require('react-native-fs')

export const getIfDatabaseExists = async sqliteFile => {
  const sqliteDirPath = `${RNFS.DocumentDirectoryPath}/SQLite`
  const dbPath = `${sqliteDirPath}/${sqliteFile}.sqlite`
  const dbFileExists = await RNFS.exists(dbPath)

  if (dbFileExists) {
    return true
  }

  return false
}

let dbDictionnaire
let dbInterlineaire
let dbTresorCommentaires

class StrongDB {
  dbStrong

  init = async () => {
    this.dbStrong = SQLite.openDatabase(
      {
        name: 'strong.sqlite',
        readOnly: true,
        createFromLocation: '/SQLite/strong.sqlite'
      },
      () => {},
      e => console.log(e)
    )

    return this.dbStrong
  }

  get = () => {
    return this.dbStrong
  }

  delete = () => {
    this.dbStrong?._db?.close()
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
  dbDictionnaire?._db?.close()
  dbDictionnaire = undefined
}

export const deleteTresorDB = () => {
  dbTresorCommentaires?._db?.close()
  dbTresorCommentaires = undefined
}

export const deleteInterlineaireDB = () => {
  dbInterlineaire?._db?.close()
  dbInterlineaire = undefined
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
    this.dbMhy?._db?.close()
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
    this.dbNave?._db?.close()
    this.dbNave = undefined
  }
}

export const naveDB = new NaveDB()

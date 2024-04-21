import * as SQLite from 'expo-sqlite'
import * as FileSystem from 'expo-file-system'
import { getDatabases } from './databases'

const RNFS = require('react-native-fs')

const databaseDictionnaireName = `dictionnaire-${Date.now()}`
const databaseStrongName = `strong-${Date.now()}`
const databaseInterlineaireName = `interlineaire-${Date.now()}`
const databaseTresorName = `tresor-${Date.now()}`
const databaseMhyName = `mhy-${Date.now()}`
const databaseNaveName = `naveFr-${Date.now()}`

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
    try {
      this.dbStrong = SQLite.openDatabase(
        databaseStrongName,
        undefined,
        undefined,
        undefined,
        () => {
          console.log('Strong loaded')
        }
      )
      return this.dbStrong
    } catch (error) {
      console.error('Error opening database:', error)
      throw error
    }
  }

  get = () => {
    return this.dbStrong
  }

  delete = async () => {
    try {
      if (this.dbStrong) {
        await this.dbStrong._db.close() // Fermer la base de données
        await FileSystem.deleteAsync(
          `${FileSystem.documentDirectory}SQLite/${databaseStrongName}.db`
        ) // Supprimer le fichier de la base de données
        console.log('Strong database deleted')
      }
    } catch (error) {
      console.error('Error deleting database:', error)
      throw error
    }
  }
}

export const strongDB = new StrongDB()

export const initDictionnaireDB = () => {
  try {
    dbDictionnaire = SQLite.openDatabase(
      databaseDictionnaireName,
      undefined,
      undefined,
      undefined,
      () => {
        console.log('Dictionnaire loaded')
      }
    )

    return dbDictionnaire
  } catch (error) {
    console.error('Error Dictionnaire loaded:', error)
    throw error
  }
}

export const initInterlineaireDB = () => {
  try {
    dbInterlineaire = SQLite.openDatabase(
      databaseInterlineaireName,
      undefined,
      undefined,
      undefined,
      () => {
        console.log('Interlineaire loaded')
      }
    )
    return dbInterlineaire
  } catch (error) {
    console.error('Error Interlineaire loaded:', error)
    throw error
  }
}

export const initTresorDB = () => {
  try {
    dbTresorCommentaires = SQLite.openDatabase(
      databaseTresorName,
      undefined,
      undefined,
      undefined,
      () => {
        console.log('Tresor loaded')
      }
    )
    return dbTresorCommentaires
  } catch (error) {
    console.error('Error Tresor loaded:', error)
    throw error
  }
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

export const deleteDictionnaireDB = async () => {
  try {
    if (dbDictionnaire) {
      await dbDictionnaire._db.close()
      await FileSystem.deleteAsync(
        `${FileSystem.documentDirectory}SQLite/${databaseDictionnaireName}.db`
      )
      console.log('Dictionnaire database deleted')
      dbDictionnaire = undefined
    }
  } catch (error) {
    console.error('Error deleting Dictionnaire database:', error)
    throw error
  }
}

export const deleteTresorDB = async () => {
  try {
    if (dbTresorCommentaires) {
      await dbTresorCommentaires._db.close()
      await FileSystem.deleteAsync(
        `${FileSystem.documentDirectory}SQLite/${databaseTresorName}.db`
      )
      dbTresorCommentaires = undefined
    }
  } catch (error) {
    console.error('Error deleting Tresor database:', error)
    throw error
  }
}

export const deleteInterlineaireDB = async () => {
  if (dbInterlineaire) {
    await dbInterlineaire._db.close()
    await FileSystem.deleteAsync(
      `${FileSystem.documentDirectory}SQLite/${databaseInterlineaireName}.db`
    )
    dbInterlineaire = undefined
  }
}

class MhyDB {
  dbMhy

  init = () => {
    try {
      this.dbMhy = SQLite.openDatabase(
        databaseMhyName,
        undefined,
        undefined,
        undefined,
        () => {
          console.log('Commentaires loaded')
        }
      )
      return this.dbMhy
    } catch (error) {
      console.error('Error Commentaires loaded:', error)
      throw error
    }
  }

  get = () => {
    return this.dbMhy
  }

  delete = async () => {
    if (this.dbMhy) {
      await this.dbMhy._db.close()
      await FileSystem.deleteAsync(
        `${FileSystem.documentDirectory}SQLite/${databaseMhyName}.db`
      )
      this.dbMhy = undefined
    }
  }
}

export const mhyDB = new MhyDB()

class NaveDB {
  dbNave

  init = async () => {
    try {
      this.dbNave = SQLite.openDatabase(
        databaseNaveName,
        undefined,
        undefined,
        undefined,
        () => {
          console.log('Nave loaded')
        }
      )
      return this.dbNave
    } catch (error) {
      console.error('Error initializing Nave database:', error)
      throw error
    }
  }

  get = () => {
    return this.dbNave
  }

  delete = async () => {
    try {
      if (this.dbNave) {
        await this.dbNave._db?.close()
        const databasePath = `${FileSystem.documentDirectory}SQLite/${databaseNaveName}.db`
        await FileSystem.deleteAsync(databasePath)
        this.dbNave = undefined
      }
    } catch (error) {
      console.error('Error deleting Nave database:', error)
      throw error
    }
  }
}

export const naveDB = new NaveDB()

export const deleteAllDatabases = async () => {
  // Reload app
  strongDB.delete()
  deleteDictionnaireDB()
  deleteTresorDB()
  mhyDB.delete()
  naveDB.delete()
  deleteInterlineaireDB()

  const intFile = await FileSystem.getInfoAsync(
    `${FileSystem.documentDirectory}SQLite/interlineaire.sqlite`
  )
  if (intFile.exists) FileSystem.deleteAsync(intFile.uri)

  await Promise.all(
    Object.values(getDatabases()).map(async db => {
      const file = await FileSystem.getInfoAsync(db.path)
      if (file.exists) await FileSystem.deleteAsync(file.uri)
    })
  )
}

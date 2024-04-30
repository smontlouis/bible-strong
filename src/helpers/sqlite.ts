import * as FileSystem from 'expo-file-system'
import * as SQLite from 'expo-sqlite'
import { getDatabases } from './databases'

export const databaseDictionnaireName = 'dictionnaire.sqlite'
export const databaseStrongName = 'strong.sqlite'
export const databaseInterlineaireName = 'interlineaire.sqlite'
export const databaseTresorName = 'tresor.sqlite'
export const databaseMhyName = 'mhy.sqlite'
export const databaseNaveName = 'nave.sqlite'

class DB {
  db?: SQLite.SQLiteDatabase
  public name: string

  constructor(name: string) {
    this.name = name
  }

  init = async () =>
    new Promise((resolve, reject) => {
      try {
        this.db = SQLite.openDatabase(
          this.name,
          undefined,
          undefined,
          undefined,
          () => {
            console.log(`${this.name} loaded`)
            resolve(true)
          }
        )
      } catch (error) {
        console.error('Error opening database:', error)
        reject(error)
      }
    })

  get = () => {
    return this.db
  }

  delete = async () => {
    try {
      if (this.db) {
        await this.db.closeAsync() // Fermer la base de données
        await FileSystem.deleteAsync(
          `${FileSystem.documentDirectory}SQLite/${this.name}`
        ) // Supprimer le fichier de la base de données
        console.log('Strong database deleted')
      }
    } catch (error) {
      console.error('Error deleting database:', error)
      throw error
    }
  }
}

export const strongDB = new DB(databaseStrongName)
export const dictionnaireDB = new DB(databaseDictionnaireName)
export const mhyDB = new DB(databaseMhyName)
export const naveDB = new DB(databaseNaveName)
export const interlineaireDB = new DB(databaseInterlineaireName)
export const tresorDB = new DB(databaseTresorName)

export const deleteAllDatabases = async () => {
  // Reload app
  strongDB.delete()
  dictionnaireDB.delete()
  tresorDB.delete()
  mhyDB.delete()
  naveDB.delete()
  interlineaireDB.delete()

  const intFile = await FileSystem.getInfoAsync(
    `${FileSystem.documentDirectory}SQLite/${databaseInterlineaireName}`
  )
  if (intFile.exists) FileSystem.deleteAsync(intFile.uri)

  await Promise.all(
    Object.values(getDatabases()).map(async db => {
      const file = await FileSystem.getInfoAsync(db.path)
      if (file.exists) await FileSystem.deleteAsync(file.uri)
    })
  )
}

export const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`

export const initSQLiteDir = async () => {
  const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

  if (!sqliteDir.exists) {
    await FileSystem.makeDirectoryAsync(sqliteDirPath)
  } else if (!sqliteDir.isDirectory) {
    throw new Error('SQLite dir is not a directory')
  }
}

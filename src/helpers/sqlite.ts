import * as FileSystem from 'expo-file-system'
import * as SQLite from 'expo-sqlite'
import { getDatabases } from './databases'

export const databaseDictionnaireName = 'dictionnaire.sqlite'
export const databaseStrongName = 'strong.sqlite'
export const databaseInterlineaireName = 'interlineaire.sqlite'
export const databaseTresorName = 'commentaires-tresor.sqlite'
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

export const checkDatabasesStorage = async () => {
  const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
  const dir = await FileSystem.readDirectoryAsync(sqliteDirPath)

  await Promise.all(
    [
      databaseStrongName,
      databaseDictionnaireName,
      databaseInterlineaireName,
      databaseTresorName,
      databaseMhyName,
      databaseNaveName,
    ].map(dbName => checkForDatabase(dbName, dir))
  )
}

export const checkForDatabase = async (
  dbName: string,
  filesInDir: string[]
) => {
  const filePath = `${FileSystem.documentDirectory}SQLite/${dbName}`
  const file = await FileSystem.getInfoAsync(filePath)

  // If file does not exist, find the first file that starts with dbName, and rename it to dbName
  if (!file.exists) {
    const fileToRename = filesInDir.find(f =>
      f.startsWith(dbName.replace('.sqlite', ''))
    )
    if (fileToRename) {
      // Check if file is not empty

      const fileToRenameInfo = await FileSystem.getInfoAsync(
        `${sqliteDirPath}/${fileToRename}`
      )

      if (fileToRenameInfo.exists && fileToRenameInfo.size !== 0) {
        console.log(`Renaming ${fileToRename} to ${dbName}`)
        await FileSystem.moveAsync({
          from: `${sqliteDirPath}/${fileToRename}`,
          to: filePath,
        })
        console.log('Done renaming')
      }
    }
  }

  // Remove all OTHER files that start with dbName
  const filesToRemove = filesInDir.filter(
    f => f.startsWith(dbName.replace('.sqlite', '')) && f !== dbName
  )
  console.log('removing...', filesToRemove)
  filesToRemove.map(f => FileSystem.deleteAsync(`${sqliteDirPath}/${f}`))
}

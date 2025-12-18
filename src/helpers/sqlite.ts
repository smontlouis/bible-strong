import * as FileSystem from 'expo-file-system/legacy'
import * as SQLite from 'expo-sqlite'
import {
  databaseDictionnaireName,
  databaseInterlineaireName,
  databaseMhyName,
  databaseNaveName,
  databaseStrongName,
  databaseTresorName,
  getDatabases,
  getDbPath,
  getDbFileName,
  initLanguageDirs,
} from './databases'
import {
  ResourceLanguage,
  DatabaseId,
  isSharedDB,
  getSqliteDirPath,
  getSharedSqliteDirPath,
  BASE_SQLITE_DIR,
} from './databaseTypes'

// Original DB class for backward compatibility
class DB {
  db?: SQLite.SQLiteDatabase
  public name: string

  constructor(name: string) {
    this.name = name
  }

  init = async () => {
    if (this.db) return

    return new Promise(async (resolve, reject) => {
      try {
        this.db = await SQLite.openDatabaseAsync(this.name)
        console.log(`[DBManager] ${this.name} loaded`)
        resolve(true)
      } catch (error) {
        console.error('Error opening database:', error)
        reject(error)
      }
    })
  }

  get = () => {
    return this.db
  }

  delete = async () => {
    try {
      if (this.db) {
        await this.db.closeAsync()
        await FileSystem.deleteAsync(`${FileSystem.documentDirectory}SQLite/${this.name}`)
        console.log('[DBManager] Database deleted:', this.name)
      }
    } catch (error) {
      console.error('Error deleting database:', error)
      throw error
    }
  }
}

// New language-aware DB class
class LanguageAwareDB {
  private db?: SQLite.SQLiteDatabase
  private dbId: DatabaseId
  private lang: ResourceLanguage
  private path: string

  constructor(dbId: DatabaseId, lang: ResourceLanguage) {
    this.dbId = dbId
    this.lang = lang
    this.path = getDbPath(dbId, lang)
  }

  init = async (): Promise<void> => {
    if (this.db) return

    try {
      // Ensure the directory exists
      await initLanguageDirs(this.lang)

      // Check if database file exists and has content BEFORE opening
      // This prevents SQLite from creating empty 0-byte files
      const fileInfo = await FileSystem.getInfoAsync(this.path)

      if (!fileInfo.exists) {
        return
      }

      if (fileInfo.size === 0) {
        // Delete the empty file to clean up
        await FileSystem.deleteAsync(this.path)
        return
      }

      // Get the file name from the path
      const fileName = this.path.split('/').pop()!
      this.db = await SQLite.openDatabaseAsync(
        fileName,
        undefined,
        this.path.replace(`/${fileName}`, '')
      )
      console.log(`[DBManager] ${this.dbId} (${this.lang}) loaded from ${this.path}`)
    } catch (error) {
      console.error(`[DBManager] Error opening ${this.dbId} (${this.lang}):`, error)
      throw error
    }
  }

  get = (): SQLite.SQLiteDatabase | undefined => {
    return this.db
  }

  close = async (): Promise<void> => {
    if (this.db) {
      try {
        await this.db.closeAsync()
        this.db = undefined
        console.log(`[DBManager] ${this.dbId} (${this.lang}) closed`)
      } catch (error) {
        console.error(`[DBManager] Error closing ${this.dbId}:`, error)
      }
    }
  }

  delete = async (): Promise<void> => {
    try {
      await this.close()
      const fileInfo = await FileSystem.getInfoAsync(this.path)
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(this.path)
        console.log(`[DBManager] ${this.dbId} (${this.lang}) deleted`)
      }
    } catch (error) {
      console.error(`[DBManager] Error deleting ${this.dbId}:`, error)
      throw error
    }
  }

  getPath = (): string => this.path
  getDbId = (): DatabaseId => this.dbId
  getLang = (): ResourceLanguage => this.lang
}

// DBManager - manages database instances by language
class DBManager {
  private instances: Map<string, LanguageAwareDB> = new Map()

  private getKey(dbId: DatabaseId, lang: ResourceLanguage): string {
    // Shared databases don't have a language suffix
    if (isSharedDB(dbId)) {
      return `shared_${dbId}`
    }
    return `${lang}_${dbId}`
  }

  /**
   * Get or create a database instance for a specific database and language
   */
  getDB(dbId: DatabaseId, lang: ResourceLanguage): LanguageAwareDB {
    const key = this.getKey(dbId, lang)

    if (!this.instances.has(key)) {
      const db = new LanguageAwareDB(dbId, isSharedDB(dbId) ? 'fr' : lang)
      this.instances.set(key, db)
    }

    return this.instances.get(key)!
  }

  /**
   * Check if a database instance exists and is initialized
   */
  isInitialized(dbId: DatabaseId, lang: ResourceLanguage): boolean {
    const key = this.getKey(dbId, lang)
    const db = this.instances.get(key)
    return db?.get() !== undefined
  }

  /**
   * Close all database instances for a specific language
   * Useful for memory management when switching languages
   */
  async closeLanguageDatabases(lang: ResourceLanguage): Promise<void> {
    const keysToClose = Array.from(this.instances.keys()).filter(key => key.startsWith(`${lang}_`))

    await Promise.all(
      keysToClose.map(async key => {
        const db = this.instances.get(key)
        if (db) {
          await db.close()
        }
      })
    )

    console.log(`[DBManager] Closed all ${lang} databases`)
  }

  /**
   * Close all database instances
   */
  async closeAll(): Promise<void> {
    await Promise.all(Array.from(this.instances.values()).map(db => db.close()))
    console.log('[DBManager] Closed all databases')
  }

  /**
   * Clear a specific database instance from the manager
   */
  clearInstance(dbId: DatabaseId, lang: ResourceLanguage): void {
    const key = this.getKey(dbId, lang)
    this.instances.delete(key)
  }
}

// Singleton instance
export const dbManager = new DBManager()

// Legacy exports for backward compatibility
// These will be gradually replaced in the codebase
export const strongDB = new DB(databaseStrongName)
export const dictionnaireDB = new DB(databaseDictionnaireName)
export const mhyDB = new DB(databaseMhyName)
export const naveDB = new DB(databaseNaveName)
export const interlineaireDB = new DB(databaseInterlineaireName)
export const tresorDB = new DB(databaseTresorName)

export const deleteAllDatabases = async () => {
  // Close all managed databases first
  await dbManager.closeAll()

  // Delete legacy databases
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

// Initialize language-specific SQLite directories
export const initSQLiteDirForLang = async (lang: ResourceLanguage) => {
  const langDir = getSqliteDirPath(lang)
  const sharedDir = getSharedSqliteDirPath()

  for (const dir of [langDir, sharedDir]) {
    const dirInfo = await FileSystem.getInfoAsync(dir)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
  }
}

// Initialize shared SQLite directory only
export const initSharedSQLiteDir = async () => {
  const sharedDir = getSharedSqliteDirPath()
  const dirInfo = await FileSystem.getInfoAsync(sharedDir)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(sharedDir, { intermediates: true })
  }
}

export const checkDatabasesStorage = async () => {
  await initSQLiteDir()
  const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
  const dir = await FileSystem.readDirectoryAsync(sqliteDirPath)

  console.log('[DBManager] Checking databases...')
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

export const checkForDatabase = async (dbName: string, filesInDir: string[]) => {
  const filePath = `${FileSystem.documentDirectory}SQLite/${dbName}`
  const file = await FileSystem.getInfoAsync(filePath)

  // If file does not exist, find the first file that starts with dbName, and rename it to dbName
  if (!file.exists) {
    const fileToRename = filesInDir.find(f => f.startsWith(dbName.replace('.sqlite', '')))
    if (fileToRename) {
      // Check if file is not empty
      console.log('[DBManager] Rename file', fileToRename)
      const fileToRenameInfo = await FileSystem.getInfoAsync(`${sqliteDirPath}/${fileToRename}`)

      if (fileToRenameInfo.exists && fileToRenameInfo.size !== 0) {
        console.log(`[DBManager] Renaming ${fileToRename} to ${dbName}`)
        await FileSystem.moveAsync({
          from: `${sqliteDirPath}/${fileToRename}`,
          to: filePath,
        })
        console.log('[DBManager] Done renaming')
      }
    }
  }

  // Remove all OTHER files that start with dbName
  const filesToRemove = filesInDir.filter(
    f => f.startsWith(dbName.replace('.sqlite', '')) && f !== dbName
  )
  filesToRemove.map(f => FileSystem.deleteAsync(`${sqliteDirPath}/${f}`))
}

// Check if a database exists for a specific language
export const checkDatabaseExistsForLang = async (
  dbId: DatabaseId,
  lang: ResourceLanguage
): Promise<boolean> => {
  const path = getDbPath(dbId, lang)
  const fileInfo = await FileSystem.getInfoAsync(path)
  return fileInfo.exists
}

// Export types and classes for use elsewhere
export { LanguageAwareDB }

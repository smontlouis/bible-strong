import { SQLiteDatabase } from 'expo-sqlite'
import { dbManager } from '~helpers/sqlite'
import { DatabaseId, ResourceLanguage, isSharedDB } from '~helpers/databaseTypes'
import { getResourceLanguage, type ResourcesLanguageState } from 'src/state/resourcesLanguage'

// Legacy transaction wrapper - kept for potential custom use cases
const getSQLTransaction =
  (getDB: () => SQLiteDatabase | undefined, initDB?: () => Promise<unknown>) =>
  (sqlReq: string, args = []) => {
    return new Promise(async (resolve, reject) => {
      if (!getDB() && initDB) {
        await initDB()
      }

      try {
        const allRows = await getDB()?.getAllAsync(sqlReq, args)
        resolve(allRows)
      } catch (error) {
        console.log('Error executing sql =>', error)
        reject(error)
      }
    })
  }

// New language-aware transaction wrapper
// Uses Redux store to get the current resource language
const getLanguageAwareSQLTransaction = (dbId: DatabaseId) => {
  return async <T = any>(sqlReq: string, args: any[] = []): Promise<T[]> => {
    // Get current language from Redux (or default for shared DBs)
    let lang: ResourceLanguage = 'fr'

    if (!isSharedDB(dbId)) {
      // For user-selectable DBs, get the language from Jotai store
      const selectableDbIds: (keyof ResourcesLanguageState)[] = [
        'STRONG',
        'DICTIONNAIRE',
        'NAVE',
        'MHY',
        'INTERLINEAIRE',
        'TIMELINE',
        'SEARCH',
      ]
      if (selectableDbIds.includes(dbId as keyof ResourcesLanguageState)) {
        lang = getResourceLanguage(dbId as keyof ResourcesLanguageState)
      }
    }

    // Get the database instance
    const db = dbManager.getDB(dbId, lang)

    // Initialize if needed
    if (!db.get()) {
      await db.init()
    }

    try {
      const allRows = await db.get()?.getAllAsync(sqlReq, args)
      return (allRows || []) as T[]
    } catch (error) {
      console.log(`[SQLTransaction] Error executing sql on ${dbId} (${lang}):`, error)
      throw error
    }
  }
}

// Transaction with explicit language parameter
// Use this when you need to query a specific language regardless of Redux state
const getSQLTransactionForLang = (dbId: DatabaseId, lang: ResourceLanguage) => {
  return async <T = any>(sqlReq: string, args: any[] = []): Promise<T[]> => {
    const db = dbManager.getDB(dbId, lang)

    if (!db.get()) {
      await db.init()
    }

    try {
      const allRows = await db.get()?.getAllAsync(sqlReq, args)
      return (allRows || []) as T[]
    } catch (error) {
      console.log(`[SQLTransaction] Error executing sql on ${dbId} (${lang}):`, error)
      throw error
    }
  }
}

// Language-aware transaction exports
// These automatically use the correct language based on Redux state
export const SQLStrongTransaction = getLanguageAwareSQLTransaction('STRONG')
export const SQLDictionnaireTransaction = getLanguageAwareSQLTransaction('DICTIONNAIRE')
export const SQLNaveTransaction = getLanguageAwareSQLTransaction('NAVE')
export const SQLTresorTransaction = getLanguageAwareSQLTransaction('TRESOR')
export const SQLMHYTransaction = getLanguageAwareSQLTransaction('MHY')
export const SQLInterlineaireTransaction = getLanguageAwareSQLTransaction('INTERLINEAIRE')

// Aliases for explicit naming (same as above)
export const SQLStrongTransactionLang = SQLStrongTransaction
export const SQLDictionnaireTransactionLang = SQLDictionnaireTransaction
export const SQLNaveTransactionLang = SQLNaveTransaction
export const SQLTresorTransactionLang = SQLTresorTransaction
export const SQLMHYTransactionLang = SQLMHYTransaction
export const SQLInterlineaireTransactionLang = SQLInterlineaireTransaction

// Export factory functions for custom usage
export { getSQLTransaction, getLanguageAwareSQLTransaction, getSQLTransactionForLang }

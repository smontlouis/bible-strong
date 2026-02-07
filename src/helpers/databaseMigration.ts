import * as FileSystem from 'expo-file-system/legacy'
import {
  ResourceLanguage,
  DatabaseId,
  LANGUAGE_SPECIFIC_DBS,
  SHARED_DBS,
  getSqliteDirPath,
  getSharedSqliteDirPath,
  getJsonDirPath,
  BASE_SQLITE_DIR,
} from '~helpers/databaseTypes'
import {
  databaseStrongName,
  databaseDictionnaireName,
  databaseNaveName,
  databaseTresorName,
  databaseMhyName,
  databaseInterlineaireName,
  getDbFileName,
  initLanguageDirs,
} from '~helpers/databases'

// SQLite databases that need migration
const SQLITE_DBS_TO_MIGRATE: DatabaseId[] = [
  'STRONG',
  'DICTIONNAIRE',
  'NAVE',
  'MHY',
  'INTERLINEAIRE',
]

// JSON files that need migration
const JSON_DBS_TO_MIGRATE: DatabaseId[] = ['TIMELINE']

/**
 * Migrate databases from old flat structure to new language-based folder structure.
 * This function is called during Redux migration and should only run once.
 *
 * Old structure:
 *   SQLite/strong.sqlite
 *   SQLite/dictionnaire.sqlite
 *   bible-timeline-events.json
 *
 * New structure:
 *   SQLite/fr/strong.sqlite
 *   SQLite/en/strong.sqlite
 *   SQLite/shared/commentaires-tresor.sqlite
 *   fr/bible-timeline-events.json
 *   en/bible-timeline-events.json
 */
export async function migrateToLanguageFolders(currentLang: ResourceLanguage): Promise<void> {
  console.log('[DB Migration] Starting migration to language folders...')
  console.log(`[DB Migration] Current language: ${currentLang}`)

  try {
    // 1. Create all necessary directories
    await initLanguageDirs('fr')
    await initLanguageDirs('en')

    // 2. Migrate SQLite databases
    for (const dbId of SQLITE_DBS_TO_MIGRATE) {
      await migrateSqliteDb(dbId, currentLang)
    }

    // 3. Migrate TRESOR to shared folder
    await migrateTresorDb()

    // 4. Migrate JSON files
    for (const dbId of JSON_DBS_TO_MIGRATE) {
      await migrateJsonFile(dbId, currentLang)
    }

    console.log('[DB Migration] Migration completed successfully!')
  } catch (error) {
    console.error('[DB Migration] Error during migration:', error)
    throw error
  }
}

/**
 * Migrate a SQLite database from old location to new language-specific location
 */
async function migrateSqliteDb(dbId: DatabaseId, targetLang: ResourceLanguage): Promise<void> {
  const fileName = getDbFileName(dbId)
  const oldPath = `${BASE_SQLITE_DIR}/${fileName}`
  const newPath = `${getSqliteDirPath(targetLang)}/${fileName}`

  await moveFileIfExists(oldPath, newPath, dbId)
}

/**
 * Migrate TRESOR database to shared folder
 */
async function migrateTresorDb(): Promise<void> {
  const fileName = getDbFileName('TRESOR')
  const oldPath = `${BASE_SQLITE_DIR}/${fileName}`
  const newPath = `${getSharedSqliteDirPath()}/${fileName}`

  await moveFileIfExists(oldPath, newPath, 'TRESOR')
}

/**
 * Migrate a JSON file from old location to new language-specific location
 */
async function migrateJsonFile(dbId: DatabaseId, targetLang: ResourceLanguage): Promise<void> {
  const fileName = getDbFileName(dbId)
  const oldPath = `${FileSystem.documentDirectory}${fileName}`
  const newPath = `${getJsonDirPath(targetLang)}/${fileName}`

  await moveFileIfExists(oldPath, newPath, dbId)
}

/**
 * Move a file if it exists at the old path and doesn't exist at the new path
 */
async function moveFileIfExists(oldPath: string, newPath: string, dbId: string): Promise<void> {
  try {
    const oldFileInfo = await FileSystem.getInfoAsync(oldPath)

    if (!oldFileInfo.exists) {
      console.log(`[DB Migration] ${dbId}: No file at old location, skipping`)
      return
    }

    // Check if file already exists at new location
    const newFileInfo = await FileSystem.getInfoAsync(newPath)
    if (newFileInfo.exists) {
      console.log(`[DB Migration] ${dbId}: File already exists at new location, removing old file`)
      await FileSystem.deleteAsync(oldPath, { idempotent: true })
      return
    }

    // Move the file
    console.log(`[DB Migration] ${dbId}: Moving from ${oldPath} to ${newPath}`)
    await FileSystem.moveAsync({
      from: oldPath,
      to: newPath,
    })
    console.log(`[DB Migration] ${dbId}: Migration successful`)
  } catch (error) {
    console.error(`[DB Migration] ${dbId}: Error moving file:`, error)
    // Don't throw - continue with other migrations
  }
}

/**
 * Check if migration is needed (i.e., if there are files in the old location)
 */
export async function isMigrationNeeded(): Promise<boolean> {
  // Check for any SQLite database in the old location
  for (const dbId of SQLITE_DBS_TO_MIGRATE) {
    const fileName = getDbFileName(dbId)
    const oldPath = `${BASE_SQLITE_DIR}/${fileName}`
    const fileInfo = await FileSystem.getInfoAsync(oldPath)
    if (fileInfo.exists) {
      return true
    }
  }

  // Check for TRESOR in old location
  const tresorPath = `${BASE_SQLITE_DIR}/${getDbFileName('TRESOR')}`
  const tresorInfo = await FileSystem.getInfoAsync(tresorPath)
  if (tresorInfo.exists) {
    return true
  }

  // Check for JSON files in old location
  for (const dbId of JSON_DBS_TO_MIGRATE) {
    const fileName = getDbFileName(dbId)
    const oldPath = `${FileSystem.documentDirectory}${fileName}`
    const fileInfo = await FileSystem.getInfoAsync(oldPath)
    if (fileInfo.exists) {
      return true
    }
  }

  return false
}

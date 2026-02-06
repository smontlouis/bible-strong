import * as FileSystem from 'expo-file-system/legacy'

import { storage } from '~helpers/storage'
import { insertBibleVersion, isVersionInstalled, openBiblesDb } from '~helpers/biblesDb'
import { versions } from '~helpers/bibleVersions'
import { isStrongVersion } from '~helpers/bibleVersions'

const MIGRATION_KEY = 'hasMigratedBiblesToSqlite'
const MIGRATED_VERSIONS_KEY = 'migratedBibleVersions'

/**
 * Check if the full migration has been completed.
 */
export function hasMigratedBibles(): boolean {
  return storage.getBoolean(MIGRATION_KEY) === true
}

/**
 * Check if Bible migration is still needed (synchronous MMKV check).
 */
export function needsBibleMigration(): boolean {
  return storage.getBoolean(MIGRATION_KEY) !== true
}

/**
 * Get the set of already-migrated version IDs (for resume safety).
 */
function getMigratedVersionIds(): Set<string> {
  const raw = storage.getString(MIGRATED_VERSIONS_KEY)
  if (!raw) return new Set()
  try {
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

function markVersionMigrated(versionId: string): void {
  const set = getMigratedVersionIds()
  set.add(versionId)
  storage.set(MIGRATED_VERSIONS_KEY, JSON.stringify([...set]))
}

/**
 * Migrate all existing JSON Bible files to bibles.sqlite.
 *
 * - Scans documentDirectory for `bible-*.json` files
 * - Parses each and inserts into SQLite via `insertBibleVersion()`
 * - Only deletes the JSON after successful insert
 * - Tracks per-version progress in MMKV so migration is resumable
 * - Also removes `idx-light.json` (Lunr search index) if present
 *
 * @param onProgress Optional callback for progress updates (current, total)
 */
export async function migrateBibleJsonToSqlite(
  onProgress?: (current: number, total: number, versionId: string) => void
): Promise<void> {
  if (hasMigratedBibles()) {
    console.log('[BibleMigration] Already migrated, skipping')
    return
  }

  console.log('[BibleMigration] Starting JSON -> SQLite migration...')
  const start = performance.now()

  // Ensure the database is open
  await openBiblesDb()

  const migratedSet = getMigratedVersionIds()

  // Find all JSON Bible files
  const docDir = FileSystem.documentDirectory!
  const allFiles = await FileSystem.readDirectoryAsync(docDir)
  const bibleJsonFiles = allFiles.filter(f => f.startsWith('bible-') && f.endsWith('.json'))

  // Also check language-specific folders
  for (const lang of ['fr', 'en']) {
    const langDir = `${docDir}${lang}`
    const langInfo = await FileSystem.getInfoAsync(langDir)
    if (langInfo.exists && langInfo.isDirectory) {
      const langFiles = await FileSystem.readDirectoryAsync(langDir)
      for (const f of langFiles) {
        if (f.startsWith('bible-') && f.endsWith('.json')) {
          bibleJsonFiles.push(`${lang}/${f}`)
        }
      }
    }
  }

  // Map file names to version IDs
  const filesToMigrate: { versionId: string; filePath: string }[] = []
  for (const file of bibleJsonFiles) {
    const fileName = file.split('/').pop()!
    const match = fileName.match(/^bible-(.+)\.json$/)
    if (!match) continue

    const versionId = match[1].toUpperCase()

    // Skip pericope files (section headers, not verse data)
    if (versionId.endsWith('-PERICOPE')) continue

    // Skip timeline events
    if (versionId === 'TIMELINE-EVENTS') continue

    // Skip strong versions (they use their own SQLite)
    if (isStrongVersion(versionId)) continue

    // Skip already migrated
    if (migratedSet.has(versionId)) continue

    // Skip if already in SQLite (e.g. from a fresh download)
    if (await isVersionInstalled(versionId)) {
      markVersionMigrated(versionId)
      continue
    }

    const fullPath = file.includes('/') ? `${docDir}${file}` : `${docDir}${file}`
    filesToMigrate.push({ versionId, filePath: fullPath })
  }

  const total = filesToMigrate.length
  console.log(`[BibleMigration] Found ${total} Bible(s) to migrate`)

  for (let i = 0; i < filesToMigrate.length; i++) {
    const { versionId, filePath } = filesToMigrate[i]

    try {
      onProgress?.(i + 1, total, versionId)
      console.log(`[BibleMigration] Migrating ${versionId} (${i + 1}/${total})...`)

      // Read and parse JSON
      const data = await FileSystem.readAsStringAsync(filePath)
      const jsonData = JSON.parse(data)

      // Insert into SQLite
      await insertBibleVersion(versionId, jsonData)

      // Mark as migrated before deleting
      markVersionMigrated(versionId)

      // Delete the JSON file
      await FileSystem.deleteAsync(filePath, { idempotent: true })
      console.log(`[BibleMigration] Migrated ${versionId} successfully`)
    } catch (e) {
      console.error(`[BibleMigration] Failed to migrate ${versionId}:`, e)
      // Continue with next version - don't block migration
    }
  }

  // Clean up Lunr search indexes
  for (const idxPath of [
    `${docDir}idx-light.json`,
    `${docDir}fr/idx-light.json`,
    `${docDir}en/idx-light.json`,
  ]) {
    const idxInfo = await FileSystem.getInfoAsync(idxPath)
    if (idxInfo.exists) {
      await FileSystem.deleteAsync(idxPath, { idempotent: true })
      console.log(`[BibleMigration] Removed Lunr index: ${idxPath}`)
    }
  }

  // Mark full migration as done
  storage.set(MIGRATION_KEY, true)

  const elapsed = performance.now() - start
  console.log(`[BibleMigration] Migration complete in ${elapsed.toFixed(0)}ms`)
}

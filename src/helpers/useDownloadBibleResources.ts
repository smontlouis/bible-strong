import { useEffect } from 'react'
import { InteractionManager } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

import { versions, isStrongVersion } from '~helpers/bibleVersions'
import { isVersionInstalled } from '~helpers/biblesDb'
import { requireBiblePath } from '~helpers/requireBiblePath'
import { versionHasRedWords, hasRedWordsFile, downloadRedWordsFile } from '~helpers/redWords'
import { versionHasPericope, hasPericopeFile, downloadPericopeFile } from '~helpers/pericopes'

interface ResourceDefinition {
  label: string
  versionSupported: (versionId: string) => boolean
  hasFile: (versionId: string) => Promise<boolean>
  downloadFile: (versionId: string) => Promise<boolean>
}

const resources: ResourceDefinition[] = [
  {
    label: 'RedWords',
    versionSupported: versionHasRedWords,
    hasFile: hasRedWordsFile,
    downloadFile: downloadRedWordsFile,
  },
  {
    label: 'Pericope',
    versionSupported: versionHasPericope,
    hasFile: hasPericopeFile,
    downloadFile: downloadPericopeFile,
  },
]

/**
 * On startup, checks all downloaded Bible versions and ensures their
 * associated resource files (red words, pericopes) are also downloaded.
 * This handles migration for users who downloaded Bibles before these
 * resources existed.
 */
function useDownloadBibleResources(): void {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      console.log('[BibleResources] Starting migration check...')

      for (const version of Object.values(versions)) {
        // Check if this version is installed (SQLite or legacy file)
        let versionExists = false
        if (!isStrongVersion(version.id)) {
          versionExists = await isVersionInstalled(version.id)
        }
        if (!versionExists) {
          const biblePath = requireBiblePath(version.id)
          const bibleInfo = await FileSystem.getInfoAsync(biblePath)
          if (!bibleInfo.exists) continue
        }

        for (const resource of resources) {
          if (!resource.versionSupported(version.id)) continue
          const exists = await resource.hasFile(version.id)
          if (exists) continue

          console.log(
            `[BibleResources] Missing ${resource.label} for ${version.id}, downloading...`
          )
          await resource.downloadFile(version.id)
        }
      }

      console.log('[BibleResources] Migration check done.')
    })

    return () => task.cancel()
  }, [])
}

export default useDownloadBibleResources

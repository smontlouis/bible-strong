import { useEffect } from 'react'
import { InteractionManager } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

import { versions } from '~helpers/bibleVersions'
import { requireBiblePath } from '~helpers/requireBiblePath'
import { versionHasPericope, hasPericopeFile, downloadPericopeFile } from '~helpers/pericopes'

const useDownloadPericopes = () => {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      console.log('[Pericope Migration] Starting check...')

      for (const version of Object.values(versions)) {
        if (!versionHasPericope(version.id)) continue

        // Check if the Bible file is downloaded locally
        const biblePath = requireBiblePath(version.id)
        const bibleInfo = await FileSystem.getInfoAsync(biblePath)
        if (!bibleInfo.exists) continue

        // Bible exists - check if pericope file is missing
        const hasFile = await hasPericopeFile(version.id)
        if (hasFile) continue

        // Download missing pericope file
        console.log(`[Pericope Migration] Missing file for ${version.id}, downloading...`)
        await downloadPericopeFile(version.id)
      }

      console.log('[Pericope Migration] Done.')
    })

    return () => task.cancel()
  }, [])
}

export default useDownloadPericopes

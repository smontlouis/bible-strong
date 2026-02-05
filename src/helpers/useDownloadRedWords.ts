import { useEffect } from 'react'
import { InteractionManager } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

import { versions } from '~helpers/bibleVersions'
import { requireBiblePath } from '~helpers/requireBiblePath'
import { versionHasRedWords, hasRedWordsFile, downloadRedWordsFile } from '~helpers/redWords'

const useDownloadRedWords = () => {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      console.log('[RedWords Migration] Starting check...')

      for (const version of Object.values(versions)) {
        if (!versionHasRedWords(version.id)) continue

        // Check if the Bible file is downloaded locally
        const biblePath = requireBiblePath(version.id)
        const bibleInfo = await FileSystem.getInfoAsync(biblePath)
        if (!bibleInfo.exists) continue

        // Bible exists - check if red words file is missing
        const hasFile = await hasRedWordsFile(version.id)
        if (hasFile) continue

        // Download missing red words file
        console.log(`[RedWords Migration] Missing file for ${version.id}, downloading...`)
        await downloadRedWordsFile(version.id)
      }

      console.log('[RedWords Migration] Done.')
    })

    return () => task.cancel()
  }, [])
}

export default useDownloadRedWords

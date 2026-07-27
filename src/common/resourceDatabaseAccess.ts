import * as FileSystem from 'expo-file-system/legacy'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getDbPath } from '~helpers/databases'
import { dbManager, initSQLiteDirForLang } from '~helpers/sqlite'
import { toast } from '~helpers/toast'
import type { DatabaseId, ResourceLanguage } from '~helpers/databaseTypes'
import { createDatabaseDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'

type ResourceDatabaseAccessState = {
  startDownload: boolean
  lang: ResourceLanguage
}

type ResourceDatabaseAccessActions = {
  setLoading: (value: boolean) => void
  setProposeDownload: (value: boolean) => void
  setStartDownload: (value: boolean) => void
  setProgress: (value: number) => void
}

export const getResourceDatabaseProgress = (totalBytesWritten: number, fileSize: number) =>
  Math.floor((totalBytesWritten / fileSize) * 100) / 100

export const useResourceDatabaseAccess = ({
  dbId,
  fileSize,
  downloadKeyPrefix,
  logName,
  ensureDirBeforePrompt = false,
  state,
  actions,
}: {
  dbId: Exclude<DatabaseId, 'BIBLES'>
  fileSize: number
  downloadKeyPrefix: string
  logName: string
  ensureDirBeforePrompt?: boolean
  state: ResourceDatabaseAccessState
  actions: ResourceDatabaseAccessActions
}) => {
  const { t } = useTranslation()
  const { startDownload, lang } = state
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const prevLangRef = useRef<ResourceLanguage>(lang)
  const itemId = `database:${dbId}:${lang}`
  const queueState = useDownloadItemStatus(itemId)

  useEffect(() => {
    const currentActions = actionsRef.current
    const isLangChange = prevLangRef.current !== lang

    if (isLangChange) {
      prevLangRef.current = lang
      currentActions.setLoading(true)
      currentActions.setProposeDownload(false)
      currentActions.setStartDownload(false)
      currentActions.setProgress(0)
    }

    const db = dbManager.getDB(dbId, lang)

    if (queueState?.status === 'downloading' || queueState?.status === 'inserting') {
      currentActions.setProgress(
        queueState.status === 'inserting' ? queueState.insertProgress : queueState.downloadProgress
      )
      return
    }
    if (queueState?.status === 'failed' || queueState?.status === 'cancelled') {
      currentActions.setProposeDownload(true)
      currentActions.setStartDownload(false)
      return
    }

    if (db.get()) {
      currentActions.setLoading(false)
      return
    }

    const loadDBAsync = async () => {
      const dbPath = getDbPath(dbId, lang)
      const dbFile = await FileSystem.getInfoAsync(dbPath)

      if (!dbFile.exists) {
        if (ensureDirBeforePrompt) {
          await initSQLiteDirForLang(lang)
        }

        if (!startDownload || isLangChange) {
          currentActions.setProposeDownload(true)
          return
        }

        try {
          await initSQLiteDirForLang(lang)
          downloadManager.enqueue([createDatabaseDownloadItem(dbId, lang)])
        } catch (error) {
          console.log(`[${logName}] Download error:`, error)
          toast.error(
            t("Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.")
          )
          currentActions.setProposeDownload(true)
          currentActions.setStartDownload(false)
        }
        return
      }

      await db.init()
      currentActions.setLoading(false)
    }

    loadDBAsync()
  }, [
    dbId,
    downloadKeyPrefix,
    ensureDirBeforePrompt,
    fileSize,
    lang,
    logName,
    queueState?.downloadProgress,
    queueState?.insertProgress,
    queueState?.status,
    startDownload,
    t,
  ])
}

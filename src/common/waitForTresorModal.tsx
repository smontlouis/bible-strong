import * as FileSystem from 'expo-file-system/legacy'
import React, { useEffect, useState } from 'react'

import { toast } from '~helpers/toast'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { getDbPath, databases } from '~helpers/databases'
import { getDatabaseUrl } from '~helpers/firebase'
import { dbManager, initSharedSQLiteDir } from '~helpers/sqlite'
import Box from './ui/Box'
import Progress from './ui/Progress'

const TRESOR_FILE_SIZE = 5434368

export const useWaitForDatabase = () => {
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // TRESOR is a shared database, use 'fr' as default (doesn't matter for shared DBs)
    const db = dbManager.getDB('TRESOR', 'fr')

    if (db.get()) {
      setLoading(false)
    } else {
      const loadDBAsync = async () => {
        const dbPath = getDbPath('TRESOR', 'fr')
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        if (!dbFile.exists) {
          // Waiting for user to accept to download
          if (!startDownload) {
            setProposeDownload(true)
            return
          }

          try {
            if (!(window as any).tresorDownloadHasStarted) {
              ;(window as any).tresorDownloadHasStarted = true

              const sqliteDbUri = getDatabaseUrl('TRESOR', 'fr')

              console.log(`[Tresor] Downloading ${sqliteDbUri} to ${dbPath}`)

              await initSharedSQLiteDir()

              await FileSystem.createDownloadResumable(
                sqliteDbUri,
                dbPath,
                undefined,
                ({ totalBytesWritten }) => {
                  const idxProgress = Math.floor((totalBytesWritten / TRESOR_FILE_SIZE) * 100) / 100
                  setProgress(idxProgress)
                }
              ).downloadAsync()

              await db.init()

              setLoading(false)
              ;(window as any).tresorDownloadHasStarted = false
            }
          } catch (e) {
            console.log('[Tresor] Download error:', e)
            toast.error(
              t(
                "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
              )
            )
            setProposeDownload(true)
            setStartDownload(false)
          }
        } else {
          await db.init()
          setLoading(false)
        }
      }

      loadDBAsync()
    }
  }, [startDownload, t])

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
  }
}

const waitForDatabase =
  <T,>(WrappedComponent: React.ComponentType<T>): React.ComponentType<T> =>
  // @ts-ignore
  (props: T) => {
    const { t } = useTranslation()
    const { isLoading, progress, proposeDownload, startDownload, setStartDownload } =
      useWaitForDatabase()

    if (isLoading && startDownload) {
      return (
        <Box h={300} alignItems="center">
          <Loading message={t('Téléchargement de la base commentaires...')}>
            <Progress progress={progress} />
          </Loading>
        </Box>
      )
    }

    if (isLoading && proposeDownload) {
      return (
        <DownloadRequired
          hasHeader={false}
          title={t(
            'La base de données "Trésor de l\'écriture" est requise pour accéder à ce module.'
          )}
          setStartDownload={setStartDownload}
          fileSize={5.4}
        />
      )
    }

    if (isLoading) {
      return (
        <Loading
          message={t('Chargement de la base de données...')}
          subMessage={t(
            "Merci de patienter, la première fois peut prendre plusieurs secondes... Si au bout de 30s il ne se passe rien, n'hésitez pas à redémarrer l'app."
          )}
        />
      )
    }

    // @ts-ignore
    return <WrappedComponent {...props} />
  }

export default waitForDatabase

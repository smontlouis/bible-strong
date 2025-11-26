import * as FileSystem from 'expo-file-system'
import React, { useEffect, useState, useRef } from 'react'
import { useAtomValue } from 'jotai'
import SnackBar from '~common/SnackBar'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { dbManager, initSQLiteDirForLang } from '~helpers/sqlite'
import { getDatabaseUrl } from '~helpers/firebase'
import { getDbPath } from '~helpers/databases'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import Box from './ui/Box'
import Progress from './ui/Progress'

const FILE_SIZE = 7448576

export const useWaitForDatabase = () => {
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState<number>(0)

  // Get current resource language from Jotai
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.NAVE

  const prevLangRef = useRef<ResourceLanguage>(resourceLang)

  useEffect(() => {
    // Reset state when language changes
    if (prevLangRef.current !== resourceLang) {
      prevLangRef.current = resourceLang
      setLoading(true)
      setProposeDownload(false)
      setStartDownload(false)
      setProgress(0)
    }

    const db = dbManager.getDB('NAVE', resourceLang)

    if (db.get()) {
      setLoading(false)
    } else {
      const loadDBAsync = async () => {
        const dbPath = getDbPath('NAVE', resourceLang)
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        if (!dbFile.exists) {
          // Waiting for user to accept to download
          if (!startDownload) {
            setProposeDownload(true)
            return
          }

          try {
            const downloadKey = `naveDownloadHasStarted_${resourceLang}`
            if (!(window as any)[downloadKey]) {
              ;(window as any)[downloadKey] = true

              const sqliteDbUri = getDatabaseUrl('NAVE', resourceLang)

              console.log(`[Nave] Downloading ${sqliteDbUri} to ${dbPath}`)

              await initSQLiteDirForLang(resourceLang)

              await FileSystem.createDownloadResumable(
                sqliteDbUri,
                dbPath,
                undefined,
                ({ totalBytesWritten }) => {
                  const idxProgress =
                    Math.floor((totalBytesWritten / FILE_SIZE) * 100) / 100
                  setProgress(idxProgress)
                }
              ).downloadAsync()

              await db.init()

              setLoading(false)
              ;(window as any)[downloadKey] = false
            }
          } catch (e) {
            SnackBar.show(
              t(
                "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
              ),
              'danger'
            )
            console.log(e)
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
  }, [startDownload, resourceLang, t])

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
    resourceLang,
  }
}

const waitForDatabase =
  ({
    hasBackButton,
    hasHeader,
    size,
  }: {
    hasBackButton?: boolean
    size?: 'small' | 'large'
    hasHeader?: boolean
  } = {}) =>
  <T,>(WrappedComponent: React.ComponentType<T>): React.ComponentType<T> =>
  (props: any) => {
    const { t } = useTranslation()
    const {
      isLoading,
      progress,
      proposeDownload,
      startDownload,
      setStartDownload,
      resourceLang,
    } = useWaitForDatabase()

    if (isLoading && startDownload) {
      return (
        <Box h={300} alignItems="center">
          <Loading message={t('Téléchargement des thèmes...')}>
            <Progress progress={progress} />
          </Loading>
        </Box>
      )
    }

    if (isLoading && proposeDownload) {
      return (
        <DownloadRequired
          hasBackButton={hasBackButton}
          hasHeader={hasHeader}
          size={size}
          title={t(
            'La base de données "Bible thématique Nave" est requise pour accéder à ce module.'
          )}
          setStartDownload={setStartDownload}
          fileSize={7}
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

    return <WrappedComponent key={resourceLang} {...props} />
  }

export default waitForDatabase

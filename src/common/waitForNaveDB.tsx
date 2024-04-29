import * as FileSystem from 'expo-file-system'
import React, { useEffect, useState } from 'react'
import SnackBar from '~common/SnackBar'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { naveDB } from '~helpers/sqlite'
import { getDatabasesRef } from '~helpers/firebase'
import Box from './ui/Box'
import Progress from './ui/Progress'
import { getDatabases } from '~helpers/databases'

const FILE_SIZE = 7448576

export const useWaitForDatabase = () => {
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState<number>(0)

  useEffect(() => {
    if (naveDB.get()) {
      setLoading(false)
    } else {
      const loadDBAsync = async () => {
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

        const dbPath = getDatabases().NAVE.path
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        // if (__DEV__) {
        //   if (dbFile.exists) {
        //     FileSystem.deleteAsync(dbFile.uri)
        //     dbFile = await FileSystem.getInfoAsync(dbPath)
        //   }
        // }

        if (!dbFile.exists) {
          // Waiting for user to accept to download
          if (!startDownload) {
            setProposeDownload(true)
            return
          }

          try {
            if (!(window as any).naveDownloadHasStarted) {
              ;(window as any).naveDownloadHasStarted = true

              const sqliteDbUri = getDatabasesRef().NAVE

              console.log(`Downloading ${sqliteDbUri} to ${dbPath}`)

              if (!sqliteDir.exists) {
                await FileSystem.makeDirectoryAsync(sqliteDirPath)
              } else if (!sqliteDir.isDirectory) {
                throw new Error('SQLite dir is not a directory')
              }

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

              await naveDB.init()

              setLoading(false)
              ;(window as any).naveDownloadHasStarted = false
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
          await naveDB.init()

          setLoading(false)
        }
      }

      loadDBAsync()
    }
  }, [startDownload])

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
  }
}

const waitForDatabase = ({
  hasBackButton,
  hasHeader,
  size,
}: {
  hasBackButton?: boolean
  size?: 'small' | 'large'
  hasHeader?: boolean
} = {}) => <T,>(
  WrappedComponent: React.ComponentType<T>
): React.ComponentType<T> => (props: any) => {
  const { t } = useTranslation()
  const {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
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

  return <WrappedComponent {...props} />
}

export default waitForDatabase

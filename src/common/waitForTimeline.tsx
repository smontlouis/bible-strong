import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'

import SnackBar from '~common/SnackBar'
import bibleMemoize from '~helpers/bibleStupidMemoize'
import Loading from '~common/Loading'
import DownloadRequired from '~common/DownloadRequired'
import { getDatabasesRef } from '~helpers/firebase'
import { getDatabases } from '~helpers/databases'
import Box from './ui/Box'
import { hp } from '~helpers/utils'
import { useTranslation } from 'react-i18next'

export const useWaitForDatabase = () => {
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState<number>()
  const dispatch = useDispatch()

  useEffect(() => {
    const loadDBAsync = async () => {
      const path = getDatabases().TIMELINE.path
      const file = await FileSystem.getInfoAsync(path)

      if (!file.exists) {
        // Waiting for user to accept to download
        if (!startDownload) {
          setProposeDownload(true)
          return
        }

        try {
          const fileUri = getDatabasesRef().TIMELINE

          console.log(`Downloading ${fileUri} to ${path}`)

          await FileSystem.createDownloadResumable(
            fileUri,
            path,
            undefined,
            ({ totalBytesWritten }) => {
              const idxProgress =
                Math.floor(
                  (totalBytesWritten / getDatabases().TIMELINE.fileSize) * 100
                ) / 100
              setProgress(idxProgress)
            }
          ).downloadAsync()

          if (bibleMemoize['timeline']) {
            setLoading(false)
            return
          }

          const data = await FileSystem.readAsStringAsync(path)
          bibleMemoize['timeline'] = JSON.parse(data)
          setLoading(false)

          setLoading(false)
        } catch (e) {
          console.log(e)
          SnackBar.show(
            t(
              "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
            ),
            'danger'
          )
          setProposeDownload(true)
          setStartDownload(false)
        }
      } else {
        const path = getDatabases().TIMELINE.path
        const data = await FileSystem.readAsStringAsync(path)

        if (bibleMemoize['timeline']) {
          setLoading(false)
          return
        }

        bibleMemoize['timeline'] = JSON.parse(data)
        setLoading(false)
      }
    }

    loadDBAsync()
  }, [dispatch, startDownload, dispatch])

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
  }
}

const waitForDatabase = (WrappedComponent: React.ReactNode) => props => {
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
      <Box center height={hp(80)}>
        <Loading message={t('Téléchargement de la chronologie...')}>
          <ProgressBar progress={Number(progress)} color="blue" />
        </Loading>
      </Box>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <Box center height={hp(80)}>
        <DownloadRequired
          title={t(
            'La chronologie biblique est requise pour accéder à ce module.'
          )}
          setStartDownload={setStartDownload}
          fileSize={Math.round(getDatabases().TIMELINE.fileSize / 1000000)}
        />
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box height={hp(80)} center>
        <Loading
          message={t('Chargement de la base de données...')}
          subMessage={t(
            "Merci de patienter, la première fois peut prendre plusieurs secondes... Si au bout de 30s il ne se passe rien, n'hésitez pas à redémarrer l'app."
          )}
        />
      </Box>
    )
  }

  return <WrappedComponent {...props} />
}

export default waitForDatabase

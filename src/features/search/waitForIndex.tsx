import * as Sentry from '@sentry/react-native'
import * as FileSystem from 'expo-file-system'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import SnackBar from '~common/SnackBar'
import Progress from '~common/ui/Progress'
import { getDatabasesRef } from '~helpers/firebase'

const IDX_LIGHT_FILE_SIZE = 16795170

export const useWaitForIndex = () => {
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [idxFile, setIdxFile] = useState<FileSystem.FileInfo | null>(null)
  const dispatch = useDispatch()

  useEffect(() => {
    const loadIndex = async () => {
      const idxPath = `${FileSystem.documentDirectory}idx-light.json`
      let idxFile = await FileSystem.getInfoAsync(idxPath)

      // if (__DEV__) {
      //   if (idxFile.exists) {
      //     FileSystem.deleteAsync(idxFile.uri)
      //     idxFile = await FileSystem.getInfoAsync(idxPath)
      //   }
      // }

      setIdxFile(idxFile)

      if (!idxFile.exists) {
        // Waiting for user to accept to download
        if (!startDownload) {
          setProposeDownload(true)
          return
        }

        const idxUri = getDatabasesRef().SEARCH

        console.log(`Downloading ${idxUri} to ${idxPath}`)

        try {
          await FileSystem.createDownloadResumable(
            idxUri,
            idxPath,
            undefined,
            ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
              const idxProgress =
                Math.floor((totalBytesWritten / IDX_LIGHT_FILE_SIZE) * 100) /
                100
              setProgress(idxProgress)
            }
          ).downloadAsync()

          console.log('Download finished')
          idxFile = await FileSystem.getInfoAsync(idxPath)
          setIdxFile(idxFile)
          setLoading(false)
        } catch (e) {
          SnackBar.show(
            "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
            'danger'
          )
          Sentry.captureException(e)
          setProposeDownload(true)
          setStartDownload(false)
        }
      } else {
        setLoading(false)
      }
    }

    loadIndex()
  }, [dispatch, startDownload])
  return {
    isLoading,
    idxFile,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
  }
}

const waitForIndex = WrappedComponent => props => {
  const { t } = useTranslation()
  const {
    isLoading,
    idxFile,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
  } = useWaitForIndex()

  if (isLoading && startDownload) {
    return (
      <Loading message={t("Téléchargement de l'index...")}>
        <Progress progress={progress} />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        title={t("L'index de recherche est requis pour accéder à cette page.")}
        setStartDownload={setStartDownload}
        fileSize={16}
        hasHeader={false}
      />
    )
  }

  if (idxFile && idxFile.exists) {
    return <WrappedComponent idxFile={idxFile} {...props} />
  }

  return <Loading message={t('Chargement...')} />
}

export default waitForIndex

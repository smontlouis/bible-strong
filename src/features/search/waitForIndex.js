import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import { Asset } from 'expo-asset'

import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import SnackBar from '~common/SnackBar'

const IDX_LIGHT_FILE_SIZE = 16795170

export const useWaitForIndex = () => {
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState(undefined)
  const [idxFile, setIdxFile] = useState(null)
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

        const idxUri = Asset.fromModule(require('~assets/lunr/idx-light.txt')).uri
        console.log(`Downloading ${idxUri} to ${idxPath}`)

        try {
          await FileSystem.createDownloadResumable(
            idxUri,
            idxPath,
            null,
            ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
              const idxProgress = Math.floor((totalBytesWritten / IDX_LIGHT_FILE_SIZE) * 100) / 100
              setProgress(idxProgress)
            }
          ).downloadAsync()

          console.log('Download finished')
          idxFile = await FileSystem.getInfoAsync(idxPath)
          setIdxFile(idxFile)
        } catch (e) {
          SnackBar.show(
            "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
            'danger'
          )
          setProposeDownload(true)
          setStartDownload(false)
        }
      }

      setLoading(false)
    }

    loadIndex()
  }, [dispatch, startDownload])
  return { isLoading, idxFile, progress, proposeDownload, startDownload, setStartDownload }
}

const waitForIndex = WrappedComponent => props => {
  const {
    isLoading,
    idxFile,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload
  } = useWaitForIndex()

  if (isLoading && startDownload) {
    return (
      <Loading message="Téléchargement de l'index..">
        <ProgressBar progress={progress} color="blue" />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        title="L'index de recherche est requis pour accéder à cette page."
        setStartDownload={setStartDownload}
        fileSize={16}
      />
    )
  }

  if (idxFile && idxFile.exists) {
    return <WrappedComponent idxFile={idxFile} {...props} />
  }

  return <Loading message="Chargement..." />
}

export default waitForIndex

import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import { Asset } from 'expo-asset'

import Loading from '~common/Loading'

const IDX_LIGHT_FILE_SIZE = 16795170

export const useWaitForIndex = () => {
  const [isLoading, setLoading] = useState(true)
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
      //     return
      //   }
      // }

      setIdxFile(idxFile)

      if (!idxFile.exists) {
        const idxUri = Asset.fromModule(require('~assets/lunr/idx-light.txt')).uri

        console.log(`Downloading ${idxUri} to ${idxPath}`)

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
      }

      setLoading(false)
    }

    loadIndex()
  }, [dispatch])
  return { isLoading, idxFile, progress }
}

const waitForIndex = WrappedComponent => props => {
  const { isLoading, idxFile, progress } = useWaitForIndex()
  const isProgressing = typeof progress !== 'undefined'

  if ((isLoading && isProgressing) || !idxFile || !idxFile.exists) {
    return (
      <Loading message="Téléchargement de l'index..">
        <ProgressBar progress={progress} color="blue" />
      </Loading>
    )
  }

  return <WrappedComponent idxFile={idxFile} {...props} />
}

export default waitForIndex

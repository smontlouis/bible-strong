import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import * as firebase from 'firebase'

import SnackBar from '~common/SnackBar'

import { naveDB } from '~helpers/database'
import Loading from '~common/Loading'
import DownloadRequired from '~common/DownloadRequired'
import { firestoreUris } from '../../config'

const FILE_SIZE = 7448576

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState(undefined)
  const dispatch = useDispatch()

  useEffect(() => {
    if (naveDB.get()) {
      setLoading(false)
    } else {
      const loadDBAsync = async () => {
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

        const dbPath = `${sqliteDirPath}/nave-fr.sqlite`
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
            if (!window.naveDownloadHasStarted) {
              window.naveDownloadHasStarted = true

              const sqliteDbUri = firestoreUris['nave-fr']

              console.log(`Downloading ${sqliteDbUri} to ${dbPath}`)

              if (!sqliteDir.exists) {
                await FileSystem.makeDirectoryAsync(sqliteDirPath)
              } else if (!sqliteDir.isDirectory) {
                throw new Error('SQLite dir is not a directory')
              }

              await FileSystem.createDownloadResumable(
                sqliteDbUri,
                dbPath,
                null,
                ({ totalBytesWritten }) => {
                  const idxProgress = Math.floor((totalBytesWritten / FILE_SIZE) * 100) / 100
                  setProgress(idxProgress)
                }
              ).downloadAsync()

              await naveDB.init()
              console.log('DB nave loaded')

              setLoading(false)
              window.naveDownloadHasStarted = false
            }
          } catch (e) {
            SnackBar.show(
              "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
              'danger'
            )
            setProposeDownload(true)
            setStartDownload(false)
          }
        } else {
          await naveDB.init()
          console.log('DB nave loaded')
          setLoading(false)
        }
      }

      loadDBAsync()
    }
  }, [dispatch, startDownload, dispatch])

  return { isLoading, progress, proposeDownload, startDownload, setStartDownload }
}

const waitForDatabase = WrappedComponent => props => {
  const {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload
  } = useWaitForDatabase()

  if (isLoading && startDownload) {
    return (
      <Loading message="Téléchargement des thèmes...">
        <ProgressBar progress={Number(progress)} color="blue" />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        hasBackButton
        title={'La base de données "Bible thématique Nave" est requise pour accéder à ce module.'}
        setStartDownload={setStartDownload}
        fileSize={7}
      />
    )
  }

  if (isLoading) {
    return (
      <Loading
        message="Chargement de la base de données..."
        subMessage="Merci de patienter, la première fois peut prendre plusieurs secondes... Si au bout de 30s il ne se passe rien, n'hésitez pas à redémarrer l'app."
      />
    )
  }

  return <WrappedComponent {...props} />
}

export default waitForDatabase

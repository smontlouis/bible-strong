import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'

import SnackBar from '~common/SnackBar'

import { initTresorDB, getTresorDB } from '~helpers/database'
import Loading from '~common/Loading'
import DownloadRequired from '~common/DownloadRequired'
import { timeout } from '~helpers/timeout'
import { storageRef } from '~helpers/firebase'

const STRONG_FILE_SIZE = 5434368

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState(undefined)
  const dispatch = useDispatch()

  useEffect(() => {
    if (getTresorDB()) {
      setLoading(false)
    } else {
      const loadDBAsync = async () => {
        await timeout(1000) // Wait safely
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

        const dbPath = `${sqliteDirPath}/commentaires-tresor.sqlite`
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
            if (!window.tresorDownloadHasStarted) {
              window.tresorDownloadHasStarted = true

              const sqliteDbUri = await storageRef
                .child('databases/commentaires-tresor.sqlite')
                .getDownloadURL()

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
                ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                  const idxProgress =
                    Math.floor((totalBytesWritten / STRONG_FILE_SIZE) * 100) /
                    100
                  setProgress(idxProgress)
                }
              ).downloadAsync()

              await initTresorDB()

              setLoading(false)
              window.tresorDownloadHasStarted = false
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
          await initTresorDB()
          setLoading(false)
        }
      }

      loadDBAsync()
    }
  }, [dispatch, startDownload, dispatch])

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload
  }
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
      <Loading message="Téléchargement de la base commentaires...">
        <ProgressBar progress={Number(progress)} color="blue" />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        noHeader
        small
        title={
          'La base de données "Trésor de l\'écriture" est requise pour accéder à ce module.'
        }
        setStartDownload={setStartDownload}
        fileSize={5.4}
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

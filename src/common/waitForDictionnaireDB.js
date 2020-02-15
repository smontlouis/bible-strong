import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'

import SnackBar from '~common/SnackBar'
import { initDictionnaireDB, getDictionnaireDB } from '~helpers/database'
import Loading from '~common/Loading'
import { useDBStateValue } from '~helpers/databaseState'
import DownloadRequired from '~common/DownloadRequired'
import { firestoreUris } from '../../config'

const DICTIONNAIRE_FILE_SIZE = 22532096

export const useWaitForDatabase = () => {
  const [
    {
      dictionnaire: { isLoading, proposeDownload, startDownload, progress }
    },
    dispatch
  ] = useDBStateValue()

  const dictionnaireDatabaseHash = useSelector(
    state => state.bible.dictionnaireDatabaseHash
  )

  useEffect(() => {
    if (getDictionnaireDB()) {
      dispatch({
        type: 'dictionnaire.setLoading',
        payload: false
      })
    } else {
      const loadDBAsync = async () => {
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

        const dbPath = `${sqliteDirPath}/dictionnaire.sqlite`
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        // if (__DEV__) {
        //   if (dbFile.exists) {
        //     FileSystem.deleteAsync(dbFile.uri)
        //     dbFile = await FileSystem.getInfoAsync(dbPath)
        //   }
        // }

        if (!dbFile.exists) {
          if (!sqliteDir.exists) {
            await FileSystem.makeDirectoryAsync(sqliteDirPath)
          } else if (!sqliteDir.isDirectory) {
            throw new Error('SQLite dir is not a directory')
          }

          // Waiting for user to accept to download
          if (!startDownload) {
            dispatch({
              type: 'dictionnaire.setProposeDownload',
              payload: true
            })
            return
          }

          const sqliteDbUri = firestoreUris.dictionnaire

          try {
            if (!window.dictionnaireDownloadHasStarted) {
              window.dictionnaireDownloadHasStarted = true
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
                    Math.floor(
                      (totalBytesWritten / DICTIONNAIRE_FILE_SIZE) * 100
                    ) / 100
                  dispatch({
                    type: 'dictionnaire.setProgress',
                    payload: idxProgress
                  })
                }
              ).downloadAsync()

              await initDictionnaireDB()

              dispatch({
                type: 'dictionnaire.setLoading',
                payload: false
              })
              window.dictionnaireDownloadHasStarted = false
            }
          } catch (e) {
            SnackBar.show(
              "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
              'danger'
            )
            dispatch({
              type: 'dictionnaire.setProposeDownload',
              payload: true
            })
            dispatch({
              type: 'dictionnaire.setStartDownload',
              payload: false
            })
          }
        } else {
          await initDictionnaireDB()

          dispatch({
            type: 'dictionnaire.setLoading',
            payload: false
          })
        }
      }

      loadDBAsync()
    }
  }, [dictionnaireDatabaseHash, dispatch, startDownload])

  const setStartDownload = value =>
    dispatch({
      type: 'dictionnaire.setStartDownload',
      payload: value
    })

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
      <Loading message="Téléchargement du dictionnaire...">
        <ProgressBar progress={progress} color="blue" />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        hasBackButton
        title="La base de données dictionnaire est requise pour accéder à cette page."
        setStartDownload={setStartDownload}
        fileSize={22}
      />
    )
  }

  if (isLoading) {
    return (
      <Loading
        message="Chargement du dictionnaire..."
        subMessage="Merci de patienter, la première fois peut prendre plusieurs secondes..."
      />
    )
  }
  return <WrappedComponent {...props} />
}

export default waitForDatabase

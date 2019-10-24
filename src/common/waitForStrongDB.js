import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import { Asset } from 'expo-asset'
import SnackBar from '~common/SnackBar'

import { initStrongDB, getStrongDB } from '~helpers/database'
import Loading from '~common/Loading'
import DownloadRequired from '~common/DownloadRequired'
import { useDBStateValue } from '~helpers/databaseState'
import { setStrongDatabaseHash } from '~redux/modules/bible'
import { timeout } from '~helpers/timeout'

const STRONG_FILE_SIZE = 34941952

export const useWaitForDatabase = () => {
  const [
    {
      strong: { isLoading, proposeDownload, startDownload, progress }
    },
    dispatch
  ] = useDBStateValue()

  const strongDatabaseHash = useSelector(state => state.bible.strongDatabaseHash)
  const dispatchRedux = useDispatch()

  useEffect(() => {
    if (getStrongDB()) {
      dispatch({
        type: 'strong.setLoading',
        payload: false
      })
    } else {
      const loadDBAsync = async () => {
        await timeout(1000) // Wait safely
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

        const dbPath = `${sqliteDirPath}/strong.sqlite`
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        // if (__DEV__) {
        //   if (dbFile.exists) {
        //     FileSystem.deleteAsync(dbFile.uri)
        //     dbFile = await FileSystem.getInfoAsync(dbPath)
        //   }
        // }

        const sqliteDB = await Asset.fromModule(require('~assets/db/strong.sqlite'))

        if (!dbFile.exists) {
          //  || sqliteDB.hash !== strongDatabaseHash

          if (sqliteDB.localUri && !window.strongDownloadHasStarted) {
            window.strongDownloadHasStarted = true

            if (!sqliteDir.exists) {
              await FileSystem.makeDirectoryAsync(sqliteDirPath)
            } else if (!sqliteDir.isDirectory) {
              throw new Error('SQLite dir is not a directory')
            }

            await FileSystem.copyAsync({
              from: sqliteDB.localUri,
              to: dbPath
            })

            await initStrongDB()

            console.log('DB strong loaded')

            dispatch({
              type: 'strong.setLoading',
              payload: false
            })
            window.strongDownloadHasStarted = false
          } else {
            // Waiting for user to accept to download
            if (!startDownload) {
              dispatch({
                type: 'strong.setProposeDownload',
                payload: true
              })
              return
            }

            try {
              if (!window.strongDownloadHasStarted) {
                window.strongDownloadHasStarted = true
                console.log(`Downloading ${sqliteDB.uri} to ${dbPath}`)

                if (!sqliteDir.exists) {
                  await FileSystem.makeDirectoryAsync(sqliteDirPath)
                } else if (!sqliteDir.isDirectory) {
                  throw new Error('SQLite dir is not a directory')
                }

                await FileSystem.createDownloadResumable(
                  sqliteDB.uri,
                  dbPath,
                  null,
                  ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                    const idxProgress =
                      Math.floor((totalBytesWritten / STRONG_FILE_SIZE) * 100) / 100
                    dispatch({
                      type: 'strong.setProgress',
                      payload: idxProgress
                    })
                  }
                ).downloadAsync()

                dispatchRedux(setStrongDatabaseHash(sqliteDB.hash))

                await initStrongDB()
                console.log('DB strong loaded')

                dispatch({
                  type: 'strong.setLoading',
                  payload: false
                })
                window.strongDownloadHasStarted = false
              }
            } catch (e) {
              SnackBar.show(
                "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
                'danger'
              )
              dispatch({
                type: 'strong.setProposeDownload',
                payload: true
              })
              dispatch({
                type: 'strong.setStartDownload',
                payload: false
              })
            }
          }
        } else {
          await initStrongDB()
          console.log('DB strong loaded')
          dispatch({
            type: 'strong.setLoading',
            payload: false
          })
        }
      }

      loadDBAsync()
    }
  }, [strongDatabaseHash, dispatch, startDownload, dispatchRedux])

  const setStartDownload = value =>
    dispatch({
      type: 'strong.setStartDownload',
      payload: value
    })

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
      <Loading message="Téléchargement de la base strong...">
        <ProgressBar progress={Number(progress)} color="blue" />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        hasBackButton
        title="La base de données strong est requise pour accéder à cette page."
        setStartDownload={setStartDownload}
        fileSize={35}
      />
    )
  }

  if (isLoading) {
    return (
      <Loading
        message="Chargement de la base strong..."
        subMessage="Merci de patienter, la première fois peut prendre plusieurs secondes... Si au bout de 30s il ne se passe rien, n'hésitez pas à redémarrer l'app."
      />
    )
  }

  return <WrappedComponent {...props} />
}

export default waitForDatabase

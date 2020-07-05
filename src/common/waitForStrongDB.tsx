import React, { useEffect } from 'react'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'

import { strongDB } from '~helpers/database'
import Loading from '~common/Loading'
import DownloadRequired from '~common/DownloadRequired'
import { useDBStateValue } from '~helpers/databaseState'
import { timeout } from '~helpers/timeout'
import { existsAssets, unzipAssets } from '~helpers/assetUtils'
import { getLangIsFr } from '~i18n'
import SnackBar from '~common/SnackBar'
import { getDatabasesRef } from '~helpers/firebase'

const RNFS = require('react-native-fs')
const STRONG_FILE_SIZE = 34941952

const useStrongZip = (dispatch: any, startDownload: any) => {
  useEffect(() => {
    if (!getLangIsFr()) {
      return
    }

    if (strongDB.get()) {
      dispatch({
        type: 'strong.setLoading',
        payload: false,
      })
    } else {
      const loadDBAsync = async () => {
        await timeout(1000) // Wait safely
        const sqliteDirPath = `${RNFS.DocumentDirectoryPath}/SQLite`
        const sqliteDirExists = await RNFS.exists(sqliteDirPath)

        const dbPath = `${sqliteDirPath}/strong.sqlite`
        const dbFileExists = await RNFS.exists(dbPath)

        const sqliteZipExists = await existsAssets('www/strong.sqlite.zip')

        if (!dbFileExists) {
          if (sqliteZipExists && !(window as any).strongDownloadHasStarted) {
            ;(window as any).strongDownloadHasStarted = true

            if (!sqliteDirExists) {
              await RNFS.mkdir(sqliteDirPath)
            }

            await unzipAssets('www/strong.sqlite.zip', sqliteDirPath)

            await strongDB.init()

            dispatch({
              type: 'strong.setLoading',
              payload: false,
            })
            ;(window as any).strongDownloadHasStarted = false
          } else {
            // Grosse erreur impossible de continuer
          }
        } else {
          await strongDB.init()

          dispatch({
            type: 'strong.setLoading',
            payload: false,
          })
        }
      }

      loadDBAsync()
    }
  }, [dispatch, startDownload])
}

const useStrongEn = (dispatch: any, startDownload: any) => {
  useEffect(() => {
    if (strongDB.get()) {
      dispatch({
        type: 'strong.setLoading',
        payload: false,
      })
    } else {
      const loadDBAsync = async () => {
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

        const dbPath = `${sqliteDirPath}/strong.sqlite`
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        if (!dbFile.exists) {
          if (!sqliteDir.exists) {
            await FileSystem.makeDirectoryAsync(sqliteDirPath)
          } else if (!sqliteDir.isDirectory) {
            throw new Error('SQLite dir is not a directory')
          }

          // Waiting for user to accept to download
          if (!startDownload) {
            dispatch({
              type: 'strong.setProposeDownload',
              payload: true,
            })
            return
          }

          try {
            if (!(window as any).strongDownloadHasStarted) {
              ;(window as any).strongDownloadHasStarted = true

              const sqliteDbUri = await getDatabasesRef().STRONG.getDownloadURL()

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
                    Math.floor((totalBytesWritten / STRONG_FILE_SIZE) * 100) /
                    100
                  dispatch({
                    type: 'strong.setProgress',
                    payload: idxProgress,
                  })
                }
              ).downloadAsync()

              await strongDB.init()

              dispatch({
                type: 'strong.setLoading',
                payload: false,
              })
              ;(window as any).strongDownloadHasStarted = false
            }
          } catch (e) {
            console.log(e)
            SnackBar.show(
              "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
              'danger'
            )
            dispatch({
              type: 'strong.setProposeDownload',
              payload: true,
            })
            dispatch({
              type: 'strong.setStartDownload',
              payload: false,
            })
          }
        } else {
          await strongDB.init()

          dispatch({
            type: 'strong.setLoading',
            payload: false,
          })
        }
      }

      loadDBAsync()
    }
  }, [dispatch, startDownload])
}

export const useWaitForDatabase = () => {
  const [
    {
      strong: { isLoading, proposeDownload, startDownload, progress },
    },
    dispatch,
  ] = useDBStateValue()

  // useStrongZip(dispatch, startDownload)
  useStrongEn(dispatch, startDownload)

  const setStartDownload = (value: boolean) => {
    dispatch({
      type: 'strong.setStartDownload',
      payload: value,
    })
  }

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
  }
}

const waitForDatabase = (WrappedComponent: React.ComponentType) => (
  props: any
) => {
  const {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
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

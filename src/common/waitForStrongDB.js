import React, { useEffect } from 'react'
import { Platform } from 'react-native'
import { useSelector } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import SnackBar from '~common/SnackBar'

import { strongDB } from '~helpers/database'
import Loading from '~common/Loading'
import DownloadRequired from '~common/DownloadRequired'
import { useDBStateValue } from '~helpers/databaseState'
import { timeout } from '~helpers/timeout'
import { existsAssets, unzipAssets } from '~helpers/assetUtils'

const RNFS = require('react-native-fs')

const delay = duration => new Promise(resolve => setTimeout(resolve, duration))

// const STRONG_FILE_SIZE = 34941952

export const useWaitForDatabase = () => {
  const [
    {
      strong: { isLoading, proposeDownload, startDownload, progress },
    },
    dispatch,
  ] = useDBStateValue()

  const strongDatabaseHash = useSelector(
    state => state.bible.strongDatabaseHash
  )

  useEffect(() => {
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
          if (sqliteZipExists && !window.strongDownloadHasStarted) {
            window.strongDownloadHasStarted = true

            if (!sqliteDirExists) {
              await RNFS.mkdir(sqliteDirPath)
            }

            await unzipAssets('www/strong.sqlite.zip', sqliteDirPath)

            await strongDB.init()

            dispatch({
              type: 'strong.setLoading',
              payload: false,
            })
            window.strongDownloadHasStarted = false
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
  }, [strongDatabaseHash, dispatch, startDownload])

  const setStartDownload = value =>
    dispatch({
      type: 'strong.setStartDownload',
      payload: value,
    })

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
  }
}

const waitForDatabase = WrappedComponent => props => {
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

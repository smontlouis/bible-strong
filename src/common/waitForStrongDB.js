import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import AssetUtils from 'expo-asset-utils'

import { initStrongDB, getStrongDB } from '~helpers/database'
import Loading from '~common/Loading'
import DownloadRequired from '~common/DownloadRequired'

import { setStrongDatabaseHash } from '~redux/modules/bible'

const STRONG_FILE_SIZE = 34941952

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState(undefined)
  const strongDatabaseHash = useSelector(state => state.bible.strongDatabaseHash)
  const dispatch = useDispatch()

  useEffect(() => {
    if (getStrongDB()) {
      setLoading(false)
    } else {
      const loadDBAsync = async () => {
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

        if (!sqliteDir.exists) {
          await FileSystem.makeDirectoryAsync(sqliteDirPath)
        } else if (!sqliteDir.isDirectory) {
          throw new Error('SQLite dir is not a directory')
        }

        const dbPath = `${sqliteDirPath}/strong.sqlite`
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        // if (__DEV__) {
        //   if (dbFile.exists) {
        //     FileSystem.deleteAsync(dbFile.uri)
        //     dbFile = await FileSystem.getInfoAsync(dbPath)
        //   }
        // }

        const sqliteDB = await AssetUtils.resolveAsync(require('~assets/db/strong.sqlite'))

        if (!dbFile.exists || sqliteDB.hash !== strongDatabaseHash) {
          // Waiting for user to accept to download
          if (!startDownload) {
            setProposeDownload(true)
            return
          }

          console.log(`Downloading ${sqliteDB.uri} to ${dbPath}`)
          await FileSystem.createDownloadResumable(
            sqliteDB.uri,
            dbPath,
            null,
            ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
              const idxProgress = Math.floor((totalBytesWritten / STRONG_FILE_SIZE) * 100) / 100
              setProgress(idxProgress)
            }
          ).downloadAsync()

          dispatch(setStrongDatabaseHash(sqliteDB.hash))
        }

        await initStrongDB()
        console.log('DB strong loaded')
        setLoading(false)
      }

      loadDBAsync()
    }
  }, [strongDatabaseHash, dispatch, startDownload])

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
        <ProgressBar progress={progress} color="blue" />
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

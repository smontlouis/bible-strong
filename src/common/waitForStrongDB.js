import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import AssetUtils from 'expo-asset-utils'

import { initStrongDB, getStrongDB } from '~helpers/database'
import Loading from '~common/Loading'
import { setStrongDatabaseHash } from '~redux/modules/bible'

const STRONG_FILE_SIZE = 34941952

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
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
        //     return
        //   }
        // }

        const sqliteDB = await AssetUtils.resolveAsync(require('~assets/db/strong.sqlite'))

        if (!dbFile.exists || sqliteDB.hash !== strongDatabaseHash) {
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
  }, [strongDatabaseHash, dispatch])

  return { isLoading, progress }
}

const waitForDatabase = WrappedComponent => props => {
  const { isLoading, progress } = useWaitForDatabase()
  const isProgressing = typeof progress !== 'undefined'

  if (isLoading && isProgressing) {
    return (
      <Loading message="Téléchargement de la base strong...">
        <ProgressBar progress={progress} color="blue" />
      </Loading>
    )
  }

  if (isLoading) {
    return <Loading message="Chargement de la base strong..." />
  }
  return <WrappedComponent {...props} />
}

export default waitForDatabase

import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import { Asset } from 'expo-asset'

import { initDictionnaireDB, getDictionnaireDB } from '~helpers/database'
import Loading from '~common/Loading'
import { setDictionnaireDatabaseHash } from '~redux/modules/bible'

const DICTIONNAIRE_FILE_SIZE = 38705152

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
  const [progress, setProgress] = useState(undefined)
  const dictionnaireDatabaseHash = useSelector(state => state.bible.dictionnaireDatabaseHash)
  const dispatch = useDispatch()

  useEffect(() => {
    if (getDictionnaireDB()) {
      setLoading(false)
    }

    const loadDBAsync = async () => {
      const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
      const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

      if (!sqliteDir.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDirPath)
      } else if (!sqliteDir.isDirectory) {
        throw new Error('SQLite dir is not a directory')
      }

      const dbPath = `${sqliteDirPath}/dictionnaire.sqlite`
      const dbFile = await FileSystem.getInfoAsync(dbPath)

      // if (__DEV__) {
      //   if (dbFile.exists) {
      //     FileSystem.deleteAsync(dbFile.uri)
      //     dbFile = await FileSystem.getInfoAsync(dbPath)
      //   }
      // }

      const sqliteDB = await Asset.fromModule(require('~assets/db/dictionnaire.sqlite'))

      if (!dbFile.exists || sqliteDB.hash !== dictionnaireDatabaseHash) {
        console.log(`Downloading ${sqliteDB.uri} to ${dbPath}`)
        await FileSystem.createDownloadResumable(
          sqliteDB.uri,
          dbPath,
          null,
          ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            const idxProgress = Math.floor((totalBytesWritten / DICTIONNAIRE_FILE_SIZE) * 100) / 100
            setProgress(idxProgress)
          }
        ).downloadAsync()

        dispatch(setDictionnaireDatabaseHash(sqliteDB.hash))
      }

      await initDictionnaireDB()
      console.log('DB dictionnaire loaded')
      setLoading(false)
    }

    loadDBAsync()
  }, [dictionnaireDatabaseHash, dispatch])
  return { isLoading, progress }
}

const waitForDatabase = WrappedComponent => props => {
  const { isLoading, progress } = useWaitForDatabase()
  const isProgressing = typeof idxProgress !== 'undefined'

  if (isLoading && isProgressing) {
    return (
      <Loading message="Téléchargement du dictionnaire...">
        <ProgressBar progress={progress} color="blue" />
      </Loading>
    )
  }

  if (isLoading) {
    return <Loading message="Chargement du dictionnaire..." />
  }
  return <WrappedComponent {...props} />
}

export default waitForDatabase

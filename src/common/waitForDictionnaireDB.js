import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import { Asset } from 'expo-asset'

import { initDictionnaireDB, getDictionnaireDB } from '~helpers/database'
import Loading from '~common/Loading'
import DownloadRequired from '~common/DownloadRequired'

import { setDictionnaireDatabaseHash } from '~redux/modules/bible'

const DICTIONNAIRE_FILE_SIZE = 22532096

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState(undefined)
  const dictionnaireDatabaseHash = useSelector(state => state.bible.dictionnaireDatabaseHash)
  const dispatch = useDispatch()

  useEffect(() => {
    if (getDictionnaireDB()) {
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
              const idxProgress =
                Math.floor((totalBytesWritten / DICTIONNAIRE_FILE_SIZE) * 100) / 100
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
    }
  }, [dictionnaireDatabaseHash, dispatch, startDownload])
  return { isLoading, progress, proposeDownload, setStartDownload }
}

const waitForDatabase = WrappedComponent => props => {
  const { isLoading, progress, proposeDownload, setStartDownload } = useWaitForDatabase()
  const isProgressing = typeof progress !== 'undefined'

  if (isLoading && isProgressing) {
    return (
      <Loading message="Téléchargement du dictionnaire...">
        <ProgressBar progress={progress} color="blue" />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        title="La base de données dictionnaire est requise pour accéder à cette page."
        setStartDownload={setStartDownload}
        fileSize={22}
      />
    )
  }

  if (isLoading) {
    return <Loading message="Chargement du dictionnaire..." />
  }
  return <WrappedComponent {...props} />
}

export default waitForDatabase

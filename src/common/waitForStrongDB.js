import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import * as FileSystem from 'expo-file-system'
import AssetUtils from 'expo-asset-utils'

import { initStrongDB, getStrongDB } from '~helpers/database'
import Loading from '~common/Loading'
import { setStrongDatabaseHash } from '~redux/modules/bible'

export const useWaitForDatabase = () => {
  const [isLoading, setLoading] = useState(true)
  const strongDatabaseHash = useSelector(state => state.bible.strongDatabaseHash)
  const dispatch = useDispatch()

  useEffect(() => {
    if (getStrongDB()) {
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
        dispatch(setStrongDatabaseHash(sqliteDB.hash))
        console.log(`Copying ${sqliteDB.localUri} to ${dbPath}`)
        await FileSystem.copyAsync({ from: sqliteDB.localUri, to: dbPath })
      }

      await initStrongDB()
      console.log('DB strong loaded')
      setLoading(false)
    }

    loadDBAsync()
  }, [strongDatabaseHash, dispatch])

  return isLoading
}

const waitForDatabase = WrappedComponent => props => {
  const isLoading = useWaitForDatabase()

  if (isLoading) {
    return <Loading message="Téléchargement de la base de données..." />
  }
  return <WrappedComponent {...props} />
}

export default waitForDatabase

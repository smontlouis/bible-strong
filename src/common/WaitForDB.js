import React from 'react'
import { FileSystem, Asset } from 'expo'
import { initDB, getDB } from '~helpers/database'
import Loading from '~common/Loading'

const WaitForDatabase = WrappedComponent =>
  class WaitForDB extends React.Component {
    state = {
      isLoading: true
    }
    componentDidMount () {
      if (getDB()) {
        return this.setState({ isLoading: false })
      }
      this.loadDBAsync()
    }
    loadDBAsync = async () => {
      const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
      const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

      if (!sqliteDir.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDirPath)
      } else if (!sqliteDir.isDirectory) {
        throw new Error('SQLite dir is not a directory')
      }

      const dbPath = `${sqliteDirPath}/strong.sqlite`
      const dbFile = await FileSystem.getInfoAsync(dbPath)

      if (!dbFile.exists) {
        const asset = Asset.fromModule(require('~assets/db/strong.sqlite'))
        await asset.downloadAsync()

        console.log(`Downloading ${asset.localUri} to ${dbPath}`)
        await FileSystem.downloadAsync(asset.localUri, dbPath)
      }

      await initDB()

      this.setState({ isLoading: false })
    }
    render () {
      if (this.state.isLoading) {
        return <Loading message='Chargement de la base de données...' />
      }
      return <WrappedComponent {...this.props} />
    }
  }

export default WaitForDatabase

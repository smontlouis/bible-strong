import React from 'react'
import { TouchableOpacity, Alert } from 'react-native'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { ProgressBar } from 'react-native-paper'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'
import * as firebase from 'firebase'
import * as Icon from '@expo/vector-icons'
import {
  deleteStrongDB,
  deleteDictionnaireDB,
  initStrongDB,
  initDictionnaireDB,
  initTresorDB
} from '~helpers/database'

import { DBStateContext } from '~helpers/databaseState'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'

const Container = styled.View({
  paddingHorizontal: 20,
  paddingTop: 10,
  paddingBottom: 10
})

const TextName = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  backgroundColor: 'transparent'
}))

const DeleteIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.quart
}))

class DBSelectorItem extends React.Component {
  static contextType = DBStateContext

  state = {
    versionNeedsDownload: undefined,
    fileProgress: 0,
    isLoading: false
  }

  async componentDidMount() {
    const versionNeedsDownload = await this.getIfDatabaseNeedsDownload()
    this.setState({ versionNeedsDownload })
  }

  getIfDatabaseNeedsDownload = async () => {
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

    if (!sqliteDir.exists) {
      await FileSystem.makeDirectoryAsync(sqliteDirPath)
    } else if (!sqliteDir.isDirectory) {
      throw new Error('SQLite dir is not a directory')
    }

    const path = this.getPath(sqliteDirPath)

    const file = await FileSystem.getInfoAsync(path)

    if (!file.exists) {
      return true
    }

    return false
  }

  getPath = () => {
    const { database } = this.props

    let path
    switch (database) {
      case 'STRONG': {
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        path = `${sqliteDirPath}/strong.sqlite`
        break
      }
      case 'DICTIONNAIRE': {
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        path = `${sqliteDirPath}/dictionnaire.sqlite`
        break
      }
      case 'SEARCH': {
        path = `${FileSystem.documentDirectory}idx-light.json`
        break
      }
      case 'TRESOR': {
        const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
        path = `${sqliteDirPath}/commentaires-tresor.sqlite`
        break
      }
      default:
    }

    return path
  }

  requireFileUri = async () => {
    const { database } = this.props
    switch (database) {
      case 'STRONG': {
        return Asset.fromModule(require('~assets/db/strong.sqlite')).uri
      }
      case 'DICTIONNAIRE': {
        return Asset.fromModule(require('~assets/db/dictionnaire.sqlite')).uri
      }
      case 'SEARCH': {
        return Asset.fromModule(require('~assets/lunr/idx-light.txt')).uri
      }
      case 'TRESOR': {
        const storageRef = firebase.storage().ref()
        const sqliteDbUri = await storageRef.child('commentaires-tresor.sqlite').getDownloadURL()

        return sqliteDbUri
      }
      default:
    }
  }

  calculateProgress = ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    const { fileSize } = this.props
    const fileProgress = Math.floor((totalBytesWritten / fileSize) * 100) / 100
    this.setState({ fileProgress })
  }

  startDownload = async () => {
    this.setState({ isLoading: true })
    const [, dispatch] = this.context

    const path = this.getPath()
    const uri = await this.requireFileUri()

    console.log(`Downloading ${uri} to ${path}`)
    try {
      await FileSystem.createDownloadResumable(
        uri,
        path,
        null,
        this.calculateProgress
      ).downloadAsync()

      console.log('Download finished')

      this.setState({ versionNeedsDownload: false, isLoading: false })
      switch (this.props.database) {
        case 'STRONG': {
          await initStrongDB()
          break
        }
        case 'DICTIONNAIRE': {
          await initDictionnaireDB()
          break
        }
        case 'TRESOR': {
          await initTresorDB()
          break
        }
        default: {
          console.log('Database download finished: Nothing to do')
        }
      }
    } catch (e) {
      SnackBar.show(
        "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
        'danger'
      )
      this.setState({ isLoading: false })
    }
  }

  confirmDelete = () => {
    Alert.alert('Attention', 'Êtes-vous vraiment sur de supprimer cette base de données ?', [
      { text: 'Non', onPress: () => null, style: 'cancel' },
      {
        text: 'Oui',
        onPress: async () => {
          const [, dispatch] = this.context
          if (this.props.database !== 'SEARCH') {
            dispatch({
              type: this.props.database === 'STRONG' ? 'strong.reset' : 'dictionnaire.reset'
            })
            if (this.props.database === 'STRONG') {
              deleteStrongDB()
            } else {
              deleteDictionnaireDB()
            }
          }

          const path = this.getPath()
          const file = await FileSystem.getInfoAsync(path)
          FileSystem.deleteAsync(file.uri)
          this.setState({ versionNeedsDownload: true })
        },
        style: 'destructive'
      }
    ])
  }

  render() {
    const { name, theme, fileSize } = this.props
    const { versionNeedsDownload, isLoading, fileProgress } = this.state

    if (typeof versionNeedsDownload === 'undefined') {
      return null
    }

    if (versionNeedsDownload) {
      return (
        <Container>
          <Box flex row>
            <Box disabled flex>
              <TextName>{name}</TextName>
            </Box>
            {!isLoading && (
              <Button
                reverse
                small
                title="Télécharger"
                subTitle={`⚠️ Taille de ${Math.round(fileSize / 1000000)}Mo`}
                onPress={this.startDownload}
              />
            )}
            {isLoading && (
              <Box width={100} justifyContent="center">
                <ProgressBar progress={fileProgress} color={theme.colors.default} />
              </Box>
            )}
          </Box>
        </Container>
      )
    }

    return (
      <Container>
        <Box flex row center>
          <Box flex>
            <TextName>{name}</TextName>
          </Box>
          <TouchableOpacity onPress={this.confirmDelete} style={{ padding: 10 }}>
            <DeleteIcon name="trash-2" size={20} />
          </TouchableOpacity>
        </Box>
      </Container>
    )
  }
}

export default withTheme(DBSelectorItem)

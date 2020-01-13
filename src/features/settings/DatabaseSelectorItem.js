import React from 'react'
import { TouchableOpacity, Alert } from 'react-native'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { ProgressBar } from 'react-native-paper'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'
import * as Icon from '@expo/vector-icons'
import { connect } from 'react-redux'
import compose from 'recompose/compose'
import {
  strongDB,
  mhyDB,
  naveDB,
  deleteDictionnaireDB,
  deleteTresorDB,
  initDictionnaireDB,
  initTresorDB
} from '~helpers/database'

import { DBStateContext } from '~helpers/databaseState'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { setSettingsCommentaires } from '~redux/modules/user'

import { firestoreUris } from '../../../config'

const Container = styled.View({
  paddingHorizontal: 20,
  paddingTop: 10,
  paddingBottom: 10
})

const TextName = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  fontWeight: 'bold',
  backgroundColor: 'transparent'
}))

const TextCopyright = styled.Text(({ isSelected, theme }) => ({
  marginTop: 5,
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 12,
  backgroundColor: 'transparent',
  opacity: 0.5
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
    this.props.shareFn(() => {
      this.setState({ versionNeedsDownload: true })
      try {
        this.delete()
      } catch (e) {
        console.log(`Nothing to delete for ${this.props.database}`)
      }
      this.startDownload()
    })
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

    const path = this.getPath()

    const file = await FileSystem.getInfoAsync(path)

    if (!file.exists) {
      return true
    }

    return false
  }

  getPath = () => {
    const { database } = this.props

    let path
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    switch (database) {
      case 'STRONG': {
        path = `${sqliteDirPath}/strong.sqlite`
        break
      }
      case 'DICTIONNAIRE': {
        path = `${sqliteDirPath}/dictionnaire.sqlite`
        break
      }
      case 'SEARCH': {
        path = `${FileSystem.documentDirectory}idx-light.json`
        break
      }
      case 'TRESOR': {
        path = `${sqliteDirPath}/commentaires-tresor.sqlite`
        break
      }
      case 'MHY': {
        path = `${sqliteDirPath}/commentaires-mhy.sqlite`
        break
      }
      case 'NAVE': {
        path = `${sqliteDirPath}/nave-fr.sqlite`
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
        const sqliteDbUri = firestoreUris.dictionnaire
        return sqliteDbUri
      }
      case 'SEARCH': {
        const sqliteDbUri = firestoreUris['idx-light']
        return sqliteDbUri
      }
      case 'TRESOR': {
        const sqliteDbUri = firestoreUris['commentaires-tresor']

        return sqliteDbUri
      }
      case 'MHY': {
        const sqliteDbUri = firestoreUris['commentaires-mhy']

        return sqliteDbUri
      }
      case 'NAVE': {
        const sqliteDbUri = firestoreUris['nave-fr']

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
          await strongDB.init()
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
        case 'MHY': {
          await mhyDB.init()
          break
        }
        case 'NAVE': {
          await naveDB.init()
          break
        }
        default: {
          console.log('Database download finished: Nothing to do')
        }
      }
    } catch (e) {
      console.log(e)
      SnackBar.show(
        "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
        'danger'
      )
      this.setState({ isLoading: false })
    }
  }

  delete = async () => {
    const [, dispatch] = this.context
    if (this.props.database !== 'SEARCH') {
      dispatch({
        type: this.props.database === 'STRONG' ? 'strong.reset' : 'dictionnaire.reset'
      })
      switch (this.props.database) {
        case 'STRONG': {
          await strongDB.delete()
          break
        }
        case 'DICTIONNAIRE': {
          await deleteDictionnaireDB()
          break
        }
        case 'TRESOR': {
          await deleteTresorDB()
          break
        }
        case 'MHY': {
          await mhyDB.delete()
          this.props.dispatch(setSettingsCommentaires(false))
          break
        }
        case 'NAVE': {
          await naveDB.delete()
          break
        }
        default: {
          console.log('Database download finished: Nothing to do')
        }
      }
    }

    const path = this.getPath()
    const file = await FileSystem.getInfoAsync(path)
    FileSystem.deleteAsync(file.uri)
    this.setState({ versionNeedsDownload: true })
  }

  confirmDelete = () => {
    Alert.alert('Attention', 'Êtes-vous vraiment sur de supprimer cette base de données ?', [
      { text: 'Non', onPress: () => null, style: 'cancel' },
      {
        text: 'Oui',
        onPress: this.delete,
        style: 'destructive'
      }
    ])
  }

  render() {
    const { name, theme, fileSize, subTitle } = this.props
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
              {subTitle && <TextCopyright>{subTitle}</TextCopyright>}
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
            {subTitle && <TextCopyright>{subTitle}</TextCopyright>}
          </Box>
          <TouchableOpacity onPress={this.confirmDelete} style={{ padding: 10 }}>
            <DeleteIcon name="trash-2" size={18} />
          </TouchableOpacity>
        </Box>
      </Container>
    )
  }
}

export default compose(
  withTheme,
  connect()
)(DBSelectorItem)

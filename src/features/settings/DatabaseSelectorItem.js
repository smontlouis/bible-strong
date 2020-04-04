import React from 'react'
import { TouchableOpacity, Alert } from 'react-native'
import * as FileSystem from 'expo-file-system'
import { ProgressBar } from 'react-native-paper'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'
import * as Icon from '@expo/vector-icons'
import { connect } from 'react-redux'
import compose from 'recompose/compose'

import { databasesRef } from '~helpers/firebase'
import { getIfDatabaseNeedsDownload } from '~helpers/databases'

import {
  strongDB,
  mhyDB,
  naveDB,
  deleteDictionnaireDB,
  deleteTresorDB,
  initDictionnaireDB,
  initTresorDB,
} from '~helpers/database'

import { DBStateContext } from '~helpers/databaseState'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { setSettingsCommentaires, setVersionUpdated } from '~redux/modules/user'

const Container = styled.View(({ needsUpdate, theme }) => ({
  padding: 20,
  paddingTop: 10,
  paddingBottom: 10,
  ...(needsUpdate
    ? {
        borderLeftColor: theme.colors.success,
        borderLeftWidth: 5,
      }
    : {}),
}))

const TextName = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  fontWeight: 'bold',
  backgroundColor: 'transparent',
}))

const TextCopyright = styled.Text(({ isSelected, theme }) => ({
  marginTop: 5,
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 12,
  backgroundColor: 'transparent',
  opacity: 0.5,
}))

const DeleteIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.quart,
}))

class DBSelectorItem extends React.Component {
  static contextType = DBStateContext

  state = {
    versionNeedsDownload: undefined,
    fileProgress: 0,
    isLoading: false,
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
    const versionNeedsDownload = await getIfDatabaseNeedsDownload(
      this.props.database
    )
    this.setState({ versionNeedsDownload })
  }

  calculateProgress = ({ totalBytesWritten }) => {
    const { fileSize } = this.props
    const fileProgress = Math.floor((totalBytesWritten / fileSize) * 100) / 100
    this.setState({ fileProgress })
  }

  startDownload = async () => {
    const { path, database } = this.props
    this.setState({ isLoading: true })

    const uri = await databasesRef[database].getDownloadURL()

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
    const { path } = this.props
    const [, dispatch] = this.context
    if (this.props.database !== 'SEARCH') {
      dispatch({
        type:
          this.props.database === 'STRONG'
            ? 'strong.reset'
            : 'dictionnaire.reset',
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

    const file = await FileSystem.getInfoAsync(path)
    FileSystem.deleteAsync(file.uri)
    this.setState({ versionNeedsDownload: true })
  }

  confirmDelete = () => {
    Alert.alert(
      'Attention',
      'Êtes-vous vraiment sur de supprimer cette base de données ?',
      [
        { text: 'Non', onPress: () => null, style: 'cancel' },
        {
          text: 'Oui',
          onPress: this.delete,
          style: 'destructive',
        },
      ]
    )
  }

  updateVersion = async () => {
    const { dispatch, database } = this.props
    await this.delete()
    await this.startDownload()
    dispatch(setVersionUpdated(database))
  }

  render() {
    const { name, theme, fileSize, subTitle, needsUpdate } = this.props
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
                <ProgressBar
                  progress={fileProgress}
                  color={theme.colors.default}
                />
              </Box>
            )}
          </Box>
        </Container>
      )
    }

    return (
      <Container needsUpdate={needsUpdate}>
        <Box flex row center>
          <Box flex>
            <TextName>{name}</TextName>
            {subTitle && <TextCopyright>{subTitle}</TextCopyright>}
          </Box>
          {needsUpdate ? (
            <TouchableOpacity
              onPress={this.updateVersion}
              style={{ padding: 10 }}
            >
              <Icon.Feather
                color={theme.colors.success}
                name="download"
                size={18}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={this.confirmDelete}
              style={{ padding: 10 }}
            >
              <DeleteIcon name="trash-2" size={18} />
            </TouchableOpacity>
          )}
        </Box>
      </Container>
    )
  }
}

export default compose(
  withTheme,
  connect((state, ownProps) => ({
    needsUpdate: state.user.needsUpdate[ownProps.database],
  }))
)(DBSelectorItem)

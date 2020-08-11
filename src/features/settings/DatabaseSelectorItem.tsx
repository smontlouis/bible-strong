import React from 'react'
import { TouchableOpacity, Alert } from 'react-native'
import * as FileSystem from 'expo-file-system'
import ProgressCircle from 'react-native-progress/Circle'
import styled from '~styled'
import { withTheme } from 'emotion-theming'
import * as Icon from '@expo/vector-icons'
import { connect } from 'react-redux'
import compose from 'recompose/compose'

import { getDatabasesRef } from '~helpers/firebase'
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
import Text from '~common/ui/Text'
import { setSettingsCommentaires, setVersionUpdated } from '~redux/modules/user'
import { FeatherIcon } from '~common/ui/Icon'
import { Theme } from '~themes'
import { withTranslation } from 'react-i18next'

const Container = styled.View(
  ({ needsUpdate, theme }: { needsUpdate: boolean; theme: Theme }) => ({
    padding: 20,
    paddingTop: 10,
    paddingBottom: 10,
    ...(needsUpdate
      ? {
          borderLeftColor: theme.colors.success,
          borderLeftWidth: 5,
        }
      : {}),
  })
)

const TextName = styled.Text(
  ({ isSelected, theme }: { isSelected: boolean; theme: Theme }) => ({
    color: isSelected ? theme.colors.primary : theme.colors.default,
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'transparent',
  })
)

const TextCopyright = styled.Text(
  ({ isSelected, theme }: { isSelected: boolean; theme: Theme }) => ({
    marginTop: 5,
    color: isSelected ? theme.colors.primary : theme.colors.default,
    fontSize: 12,
    backgroundColor: 'transparent',
    opacity: 0.5,
  })
)

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
    const { path, database, t } = this.props
    this.setState({ isLoading: true })

    const uri = await getDatabasesRef()[database].getDownloadURL()

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
        t(
          "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
        ),
        'danger'
      )
      this.setState({ isLoading: false })
    }
  }

  delete = async () => {
    const { path } = this.props
    const [, dispatch] = this.context

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

    const file = await FileSystem.getInfoAsync(path)
    FileSystem.deleteAsync(file.uri)
    this.setState({ versionNeedsDownload: true })
  }

  confirmDelete = () => {
    Alert.alert(
      this.props.t('Attention'),
      this.props.t(
        'Êtes-vous vraiment sur de supprimer cette base de données ?'
      ),
      [
        { text: this.props.t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: this.props.t('Oui'),
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
    const { name, theme, fileSize, subTitle, needsUpdate, t } = this.props
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
              <TouchableOpacity
                onPress={this.startDownload}
                style={{ padding: 10, alignItems: 'flex-end' }}
              >
                <FeatherIcon name="download" size={20} />
                <Box center marginTop={5}>
                  <Text fontSize={10}>{`⚠️ ${t('Taille de')} ${Math.round(
                    fileSize / 1000000
                  )}Mo`}</Text>
                </Box>
              </TouchableOpacity>
            )}
            {isLoading && (
              <Box
                width={100}
                justifyContent="center"
                alignItems="flex-end"
                mr={10}
              >
                <ProgressCircle
                  size={25}
                  progress={fileProgress}
                  borderWidth={0}
                  thickness={3}
                  color={theme.colors.primary}
                  unfilledColor={theme.colors.lightGrey}
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
  withTranslation(),
  withTheme,
  connect((state, ownProps) => ({
    needsUpdate: state.user.needsUpdate[ownProps.database],
  }))
)(DBSelectorItem)

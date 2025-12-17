import styled from '@emotion/native'
import { withTheme } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system'
import React from 'react'
import { Alert, TouchableOpacity } from 'react-native'
import ProgressCircle from 'react-native-progress/Circle'
import { connect } from 'react-redux'
import compose from 'recompose/compose'
import {
  getIfDatabaseNeedsDownload,
  getIfDatabaseNeedsDownloadForLang,
  getDbPath,
} from '~helpers/databases'
import { getDatabasesRef, getDatabaseUrl } from '~helpers/firebase'
import type { ResourceLanguage, DatabaseId } from '~helpers/databaseTypes'

import { dbManager } from '~helpers/sqlite'

import { withTranslation } from 'react-i18next'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { DBStateContext } from '~helpers/databaseState'
import { setSettingsCommentaires, setVersionUpdated } from '~redux/modules/user'
import { Theme } from '~themes'

const Container = styled.View(({ needsUpdate, theme }: { needsUpdate: boolean; theme: Theme }) => ({
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

const TextName = styled.Text(({ isSelected, theme }: { isSelected: boolean; theme: Theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  fontWeight: 'bold',
  backgroundColor: 'transparent',
}))

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

class DBSelectorItem extends React.Component<any, any> {
  static contextType = DBStateContext

  state = {
    versionNeedsDownload: undefined,
    fileProgress: 0,
    isLoading: false,
  }

  async componentDidMount() {
    const { database, lang } = this.props
    // Use language-aware check if lang prop is provided
    const versionNeedsDownload = lang
      ? await getIfDatabaseNeedsDownloadForLang(database, lang)
      : await getIfDatabaseNeedsDownload(database)
    this.setState({ versionNeedsDownload })
  }

  // Get the actual path based on lang prop
  getPath = () => {
    const { database, lang, path } = this.props
    if (lang) {
      return getDbPath(database as DatabaseId, lang)
    }
    return path
  }

  // Get the download URL based on lang prop
  getDownloadUrl = () => {
    const { database, lang } = this.props
    if (lang) {
      return getDatabaseUrl(database as DatabaseId, lang)
    }
    return getDatabasesRef()[database]
  }

  calculateProgress = ({ totalBytesWritten }: any) => {
    const { fileSize } = this.props
    const fileProgress = Math.floor((totalBytesWritten / fileSize) * 100) / 100
    this.setState({ fileProgress })
  }

  startDownload = async () => {
    const { database, lang, t } = this.props
    this.setState({ isLoading: true })

    const uri = this.getDownloadUrl()
    const downloadPath = this.getPath()

    console.log(`Downloading ${uri} to ${downloadPath}`)
    try {
      await FileSystem.createDownloadResumable(
        uri,
        downloadPath,
        undefined,
        this.calculateProgress
      ).downloadAsync()

      console.log('Download finished')

      this.setState({ versionNeedsDownload: false, isLoading: false })

      // Initialize the database after download
      // Use dbManager for language-aware initialization
      if (lang) {
        const db = dbManager.getDB(database as DatabaseId, lang)
        await db.init()
      } else {
        // Fallback for legacy usage without lang prop
        const db = dbManager.getDB(database as DatabaseId, 'fr')
        await db.init()
      }
    } catch (e) {
      console.log(e)
      SnackBar.show(
        t("Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."),
        'danger'
      )
      this.setState({ isLoading: false })
    }
  }

  delete = async () => {
    const { database, lang } = this.props
    // @ts-ignore
    const [, dispatch] = this.context

    dispatch({
      type: database === 'STRONG' ? 'strong.reset' : 'dictionnaire.reset',
    })

    // Use dbManager to delete the database
    const effectiveLang = lang || 'fr'
    const db = dbManager.getDB(database as DatabaseId, effectiveLang)
    await db.delete()

    if (database === 'MHY') {
      this.props.dispatch(setSettingsCommentaires(false))
    }

    const downloadPath = this.getPath()
    const file = await FileSystem.getInfoAsync(downloadPath)
    if (file.exists) {
      await FileSystem.deleteAsync(file.uri)
    }
    this.setState({ versionNeedsDownload: true })
  }

  confirmDelete = () => {
    Alert.alert(
      this.props.t('Attention'),
      this.props.t('Êtes-vous vraiment sur de supprimer cette base de données ?'),
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
        <Container needsUpdate={false} theme={theme}>
          <Box flex row>
            <Box disabled flex>
              {/* @ts-ignore */}
              <TextName isSelected={false} theme={theme}>
                {name}
              </TextName>
              {/* @ts-ignore */}
              {subTitle && (
                <TextCopyright isSelected={false} theme={theme}>
                  {subTitle}
                </TextCopyright>
              )}
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
              <Box width={100} justifyContent="center" alignItems="flex-end" mr={10}>
                <ProgressCircle
                  size={25}
                  progress={fileProgress}
                  borderWidth={0}
                  thickness={3}
                  color={theme.colors.primary}
                  unfilledColor={theme.colors.lightGrey}
                  fill="none"
                />
              </Box>
            )}
          </Box>
        </Container>
      )
    }

    return (
      <Container needsUpdate={needsUpdate} theme={theme}>
        <Box flex row center>
          <Box flex>
            {/* @ts-ignore */}
            <TextName isSelected={false} theme={theme}>
              {name}
            </TextName>
            {/* @ts-ignore */}
            {subTitle && (
              <TextCopyright isSelected={false} theme={theme}>
                {subTitle}
              </TextCopyright>
            )}
          </Box>
          {needsUpdate ? (
            <TouchableOpacity onPress={this.updateVersion} style={{ padding: 10 }}>
              <Icon.Feather color={theme.colors.success} name="download" size={18} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={this.confirmDelete} style={{ padding: 10 }}>
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
  // @ts-ignore
  connect((state: any, ownProps: any) => ({
    needsUpdate: state.user.needsUpdate[ownProps.database],
  }))
  // @ts-ignore
)(DBSelectorItem)

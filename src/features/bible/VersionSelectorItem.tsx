import React from 'react'
import * as FileSystem from 'expo-file-system'
import { TouchableOpacity, Alert } from 'react-native'
import { ProgressBar } from 'react-native-paper'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'
import * as Icon from '@expo/vector-icons'
import { useDispatch, useSelector } from 'react-redux'
import { biblesRef } from '~helpers/firebase'

import { setVersion } from '~redux/modules/bible'
import { setVersionUpdated } from '~redux/modules/user'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { initInterlineaireDB, deleteInterlineaireDB } from '~helpers/database'

const BIBLE_FILESIZE = 2500000

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

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const TouchableContainer = Container.withComponent(TouchableOpacity)

const TextVersion = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 12,
  opacity: 0.5,
  fontWeight: 'bold',
}))

const TextCopyright = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 10,
  backgroundColor: 'transparent',
  opacity: 0.5,
}))

const TextName = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  backgroundColor: 'transparent',
}))

const DeleteIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.quart,
}))

const UpdateIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.success,
}))

const VersionSelectorItem = ({
  version,
  isSelected,
  onChange,
  theme,
  isParameters,
  shareFn,
}) => {
  const [versionNeedsDownload, setVersionNeedsDownload] = React.useState(
    undefined
  )
  const [fileProgress, setFileProgress] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const needsUpdate = useSelector(state => state.user.needsUpdate[version.id])
  const dispatch = useDispatch()

  React.useEffect(() => {
    ;(async () => {
      if (shareFn && version.id !== 'LSG' && version.id !== 'LSGS') {
        shareFn(() => {
          setVersionNeedsDownload(true)
          startDownload()
        })
      }

      const v = await getIfVersionNeedsDownload(version.id)
      setVersionNeedsDownload(v)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const requireBiblePath = id => {
    if (id === 'INT') {
      const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
      return `${sqliteDirPath}/interlineaire.sqlite`
    }

    return `${FileSystem.documentDirectory}bible-${id}.json`
  }

  const calculateProgress = ({ totalBytesWritten }) => {
    const fileProgress =
      Math.floor((totalBytesWritten / BIBLE_FILESIZE) * 100) / 100
    setFileProgress(fileProgress)
  }

  const startDownload = React.useCallback(async () => {
    setIsLoading(true)

    const path = requireBiblePath(version.id)
    const uri = await biblesRef[version.id].getDownloadURL()

    console.log(`Downloading ${uri} to ${path}`)
    try {
      await FileSystem.createDownloadResumable(
        uri,
        path,
        null,
        calculateProgress
      ).downloadAsync()

      console.log('Download finished')

      if (version.id === 'INT') {
        await initInterlineaireDB()
      }

      setVersionNeedsDownload(false)
      setIsLoading(false)
    } catch (e) {
      console.log(e)
      SnackBar.show(
        "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
        'danger'
      )
      setIsLoading(false)
    }
  }, [version.id])

  const updateVersion = async () => {
    await deleteVersion()
    await startDownload()
    dispatch(setVersionUpdated(version.id))
  }

  const deleteVersion = async () => {
    const path = requireBiblePath(version.id)
    const file = await FileSystem.getInfoAsync(path)
    if (!file.uri) {
      console.log(`Nothing to delete for ${version.id}`)
      return
    }
    FileSystem.deleteAsync(file.uri)
    setVersionNeedsDownload(true)
    dispatch(setVersion('LSG'))

    if (version.id === 'INT') {
      deleteInterlineaireDB()
    }
  }

  const confirmDelete = () => {
    Alert.alert(
      'Attention',
      'Êtes-vous vraiment sur de supprimer cette version ?',
      [
        { text: 'Non', onPress: () => null, style: 'cancel' },
        {
          text: 'Oui',
          onPress: deleteVersion,
          style: 'destructive',
        },
      ]
    )
  }

  if (
    typeof versionNeedsDownload === 'undefined' ||
    (isParameters && version.id === 'LSG') ||
    (isParameters && version.id === 'LSGS')
  ) {
    return null
  }

  if (versionNeedsDownload) {
    return (
      <Container>
        <Box flex row>
          <Box disabled flex>
            <TextVersion>{version.id}</TextVersion>
            <TextName>{version.name}</TextName>
            <TextCopyright>{version.c}</TextCopyright>
          </Box>
          {!isLoading && version.id !== 'LSGS' && (
            <TouchableOpacity
              onPress={startDownload}
              style={{ padding: 10, alignItems: 'flex-end' }}
            >
              <FeatherIcon name="download" size={20} />
              {version.id === 'INT' && (
                <Box center marginTop={5}>
                  <Text fontSize={10}>⚠️ Taille de 20Mo</Text>
                </Box>
              )}
            </TouchableOpacity>
          )}
          {isLoading && (
            <Box width={80} justifyContent="center">
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

  if (isParameters) {
    return (
      <Container needsUpdate={needsUpdate}>
        <Box flex row center>
          <Box flex>
            <TextVersion>{version.id}</TextVersion>
            <TextName>{version.name}</TextName>
          </Box>
          {needsUpdate ? (
            <TouchableOpacity onPress={updateVersion} style={{ padding: 10 }}>
              <UpdateIcon name="download" size={18} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={confirmDelete} style={{ padding: 10 }}>
              <DeleteIcon name="trash-2" size={18} />
            </TouchableOpacity>
          )}
        </Box>
      </Container>
    )
  }

  return (
    <TouchableContainer
      needsUpdate={needsUpdate}
      onPress={() => onChange(version.id)}
    >
      <TextVersion isSelected={isSelected}>{version.id}</TextVersion>
      <TextName isSelected={isSelected}>{version.name}</TextName>
      <TextCopyright>{version.c}</TextCopyright>
    </TouchableContainer>
  )
}

export default withTheme(VersionSelectorItem)

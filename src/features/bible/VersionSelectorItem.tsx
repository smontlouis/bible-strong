import React from 'react'
import * as FileSystem from 'expo-file-system'
import { TouchableOpacity, Alert } from 'react-native'
import ProgressCircle from 'react-native-progress/Circle'
import * as Icon from '@expo/vector-icons'
import { useDispatch, useSelector } from 'react-redux'
import { biblesRef, getDatabasesRef } from '~helpers/firebase'

import { setVersion } from '~redux/modules/bible'
import { setVersionUpdated } from '~redux/modules/user'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getIfVersionNeedsDownload, Version } from '~helpers/bibleVersions'
import { initInterlineaireDB, deleteInterlineaireDB } from '~helpers/database'
import styled from '@emotion/native'
import { Theme } from '~themes'
import { RootState } from '~redux/modules/reducer'
import { isStrongVersion } from '~helpers/bibleVersions'
import { useTheme } from '@emotion/react'
import { FeatherIcon } from '~common/ui/Icon'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'

const BIBLE_FILESIZE = 2500000

const Container = styled.View(
  ({ needsUpdate, theme }: { needsUpdate?: boolean; theme: Theme }) => ({
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

const TouchableContainer = Container.withComponent(TouchableOpacity)

const TextVersion = styled.Text(
  ({ isSelected, theme }: { isSelected?: boolean; theme: Theme }) => ({
    color: isSelected ? theme.colors.primary : theme.colors.default,
    fontSize: 12,
    opacity: 0.5,
    fontWeight: 'bold',
  })
)

const TextCopyright = styled.Text(
  ({ isSelected, theme }: { isSelected?: boolean; theme: Theme }) => ({
    color: isSelected ? theme.colors.primary : theme.colors.default,
    fontSize: 10,
    backgroundColor: 'transparent',
    opacity: 0.5,
  })
)

const TextName = styled.Text(
  ({ isSelected, theme }: { isSelected?: boolean; theme: Theme }) => ({
    color: isSelected ? theme.colors.primary : theme.colors.default,
    fontSize: 16,
    backgroundColor: 'transparent',
  })
)

const DeleteIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.quart,
}))

const UpdateIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.success,
}))

interface Props {
  version: Version
  isSelected?: boolean
  onChange?: (id: string) => void
  isParameters?: boolean
  shareFn?: (fn: () => void) => void
}

const VersionSelectorItem = ({
  version,
  isSelected,
  onChange,
  isParameters,
  shareFn,
}: Props) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const theme: Theme = useTheme()
  const [versionNeedsDownload, setVersionNeedsDownload] = React.useState<
    boolean
  >()
  const [fileProgress, setFileProgress] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const needsUpdate = useSelector(
    (state: RootState) => state.user.needsUpdate[version.id]
  )
  const dispatch = useDispatch()

  React.useEffect(() => {
    ;(async () => {
      if (shareFn && !isStrongVersion(version.id)) {
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

  const requireBiblePath = (id: string) => {
    if (id === 'INT') {
      const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
      return `${sqliteDirPath}/interlineaire.sqlite`
    }

    return `${FileSystem.documentDirectory}bible-${id}.json`
  }

  const calculateProgress: FileSystem.DownloadProgressCallback = ({
    totalBytesWritten,
  }) => {
    const fileProgress =
      Math.floor((totalBytesWritten / BIBLE_FILESIZE) * 100) / 100
    setFileProgress(fileProgress)
  }

  const startDownload = React.useCallback(async () => {
    setIsLoading(true)

    const path = requireBiblePath(version.id)
    const uri =
      version.id === 'INT'
        ? await getDatabasesRef().INTERLINEAIRE.getDownloadURL()
        : await biblesRef[version.id].getDownloadURL()

    console.log(`Downloading ${uri} to ${path}`)
    try {
      await FileSystem.createDownloadResumable(
        uri,
        path,
        undefined,
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
        t(
          "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
        ),
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
    dispatch(setVersion(isFR ? 'LSG' : 'KJV'))

    if (version.id === 'INT') {
      deleteInterlineaireDB()
    }
  }

  const confirmDelete = () => {
    Alert.alert(
      t('Attention'),
      t('Êtes-vous vraiment sur de supprimer cette version ?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: deleteVersion,
          style: 'destructive',
        },
      ]
    )
  }

  if (
    typeof versionNeedsDownload === 'undefined' ||
    (isParameters && version.id === 'LSGS') ||
    (isParameters && version.id === 'KJVS')
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
          {!isLoading && version.id !== 'LSGS' && version.id !== 'KJVS' && (
            <TouchableOpacity
              onPress={startDownload}
              style={{ padding: 10, alignItems: 'flex-end' }}
            >
              <FeatherIcon name="download" size={20} />
              {version.id === 'INT' && (
                <Box center marginTop={5}>
                  <Text fontSize={10}>⚠️ {t('Taille de')} 20Mo</Text>
                </Box>
              )}
            </TouchableOpacity>
          )}
          {isLoading && (
            <Box
              width={80}
              justifyContent="center"
              alignItems="flex-end"
              mr={10}
            >
              <ProgressCircle
                size={20}
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
            version.id !== 'LSG' &&
            version.id !== 'KJV' && (
              <TouchableOpacity onPress={confirmDelete} style={{ padding: 10 }}>
                <DeleteIcon name="trash-2" size={18} />
              </TouchableOpacity>
            )
          )}
        </Box>
      </Container>
    )
  }

  return (
    <TouchableContainer
      needsUpdate={needsUpdate}
      onPress={() => onChange && onChange(version.id)}
    >
      <TextVersion isSelected={isSelected}>{version.id}</TextVersion>
      <TextName isSelected={isSelected}>{version.name}</TextName>
      <TextCopyright>{version.c}</TextCopyright>
    </TouchableContainer>
  )
}

export default VersionSelectorItem

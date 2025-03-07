import React, { useEffect, useState } from 'react'
import * as FileSystem from 'expo-file-system'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { format } from 'date-fns'
import Button from '~common/ui/Button'
import { shallowEqual } from 'recompose'
import { RootState } from '~redux/modules/reducer'
import { useDispatch, useSelector } from 'react-redux'
import Snackbar from '~common/SnackBar'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { importData } from '~redux/modules/user'
import { Platform } from 'react-native'
import fileSystemStorage from '~helpers/fileSystemStorage'

const ImportExport = () => {
  const { t } = useTranslation()

  return (
    <Container>
      <Header hasBackButton title={t('app.importexport')} />
      <ScrollView style={{ flex: 1 }}>
        <Box paddingHorizontal={20}>
          <Text fontSize={20} bold>
            {t('app.export')}
          </Text>
          <Text mt={10} fontSize={12}>
            {t('app.exportDesc')}
          </Text>
          <LastSave />
        </Box>
        <Box mt={40} paddingHorizontal={20}>
          <Text fontSize={20} bold>
            {t('app.import')}
          </Text>
          <Text mt={10} color="quart" fontSize={12}>
            {t('app.importDesc')}
          </Text>
          <ImportSave />
        </Box>
        <Box mt={40} paddingHorizontal={20} opacity={0.3}>
          <Text fontSize={14} bold>
            Debug FileSystemStorage
          </Text>
          <FileSystemStorageDebug />
        </Box>
      </ScrollView>
    </Container>
  )
}

const LastSave = () => {
  const { t } = useTranslation()
  const [lastSave, setLastSave] = React.useState<FileSystem.FileInfo>()

  useEffect(() => {
    const checkLastSave = async () => {
      const savePath = `${FileSystem.documentDirectory}/save.biblestrong`
      const saveFile = await FileSystem.getInfoAsync(savePath)
      if (saveFile.exists) {
        setLastSave(saveFile)
      } else {
        console.log('File does not exist')
      }
    }
    checkLastSave()
  }, [])

  return (
    <Box marginTop={20}>
      <Text bold>{t('app.lastSave')}</Text>
      {lastSave ? (
        <Text marginTop={5} color="grey">
          {format((lastSave?.modificationTime || 0) * 1000, 'dd/MM/yyyy HH:mm')}
        </Text>
      ) : (
        <Text color="grey">{t('app.noSave')}</Text>
      )}
      <ExportButton setLastSave={setLastSave} />
    </Box>
  )
}

const ExportButton = ({
  setLastSave,
}: {
  setLastSave: React.Dispatch<
    React.SetStateAction<FileSystem.FileInfo | undefined>
  >
}) => {
  const { t } = useTranslation()

  const [isSyncing, setIsSyncing] = useState(false)
  const { user, plan } = useSelector(
    (state: RootState) => ({
      user: state.user,
      plan: state.plan,
    }),
    shallowEqual
  )

  const exportAsync = async (json: string) => {
    const fileUri = FileSystem.documentDirectory + 'save.biblestrong'

    const UTI = 'save.biblestrong'

    await Sharing.shareAsync(fileUri, { UTI }).catch((error) => {
      console.log(error)
    })
  }

  const sync = async () => {
    setIsSyncing(true)

    try {
      const sanitizeUserBible = ({ changelog, studies, ...rest }) => rest
      const json = JSON.stringify({
        bible: sanitizeUserBible(user.bible),
        plan: plan.ongoingPlans,
        studies: user.bible.studies,
      })

      const fileUri = FileSystem.documentDirectory + 'save.biblestrong'

      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      if (Platform.OS === 'android') {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()

        if (permissions.granted) {
          await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            'save.biblestrong',
            'application/json'
          )
            .then(async (uri) => {
              await FileSystem.writeAsStringAsync(uri, json)
            })
            .catch((e) => console.log(e))
        } else {
          await exportAsync(json)
        }
      } else {
        await exportAsync(json)
      }

      const saveFile = await FileSystem.getInfoAsync(fileUri)
      setLastSave(saveFile)
      Snackbar.show(t('app.exported'))
    } catch (error) {
      Snackbar.show(t('Une erreur est survenue'))
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button
      style={{ width: 130, marginTop: 20 }}
      reverse
      small
      onPress={isSyncing ? () => {} : sync}
    >
      <Text fontSize={15} opacity={isSyncing ? 0.4 : 1}>
        {t('app.export')}
      </Text>
    </Button>
  )
}

const ImportSave = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const importSave = async () => {
    try {
      const file = await DocumentPicker.getDocumentAsync({
        multiple: false,
      })

      if (file.assets?.length) {
        const save = await FileSystem.readAsStringAsync(file.assets[0].uri)

        const data = JSON.parse(save)

        if (!data.bible) {
          throw new Error('Invalid save file')
        }

        dispatch(importData(data))
        Snackbar.show(t('app.imported'))
      }
    } catch (error) {
      console.log(error)
      Snackbar.show(t('Une erreur est survenue'))
    }
  }

  return (
    <Button
      style={{ width: 130, marginTop: 20 }}
      reverse
      small
      onPress={importSave}
    >
      <Text fontSize={15}>{t('app.import')}</Text>
    </Button>
  )
}

const FileSystemStorageDebug = () => {
  const [rootContent, setRootContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStorageContent = async () => {
    setIsLoading(true)
    try {
      // Try to get the "root" key directly
      const rootValue = await fileSystemStorage.getItem('root')

      if (rootValue) {
        try {
          // Parse the JSON content
          const parsedContent = JSON.parse(rootValue)
          const user = JSON.parse(parsedContent.user)
          setRootContent(user.bible.studies)
        } catch (parseError) {
          console.error('Error parsing root content:', parseError)
          // If parsing fails, show the raw content
          setRootContent({ raw: rootValue })
        }
      } else {
        throw new Error('Root key not found')
      }
    } catch (error) {
      console.error('Error loading root content:', error)
      setRootContent(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStorageContent()
  }, [])

  const renderJsonContent = (content: any, level = 0) => {
    if (content === null || content === undefined) {
      return <Text>null</Text>
    }

    if (typeof content !== 'object') {
      return <Text>{String(content)}</Text>
    }

    if (Array.isArray(content)) {
      return (
        <Box paddingLeft={level > 0 ? 10 : 0}>
          {content.length === 0 ? (
            <Text>[]</Text>
          ) : (
            content.map((item, index) => (
              <Box key={index}>
                <Text bold>{index}: </Text>
                {renderJsonContent(item, level + 1)}
              </Box>
            ))
          )}
        </Box>
      )
    }

    const entries = Object.entries(content)
    if (entries.length === 0) {
      return <Text>{'{}'}</Text>
    }

    return (
      <Box paddingLeft={level > 0 ? 10 : 0}>
        {entries.map(([key, value], index) => (
          <Box key={key} marginTop={index > 0 ? 5 : 0}>
            <Text bold>{key}: </Text>
            {renderJsonContent(value, level + 1)}
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box marginTop={20}>
      {isLoading ? (
        <Text>Loading root content...</Text>
      ) : rootContent ? (
        <Box
          marginTop={10}
          padding={10}
          backgroundColor="rgba(0,0,0,0.05)"
          borderRadius={5}
        >
          <Text bold fontSize={16} marginBottom={10}>
            Root Content:
          </Text>
          {renderJsonContent(rootContent)}
        </Box>
      ) : (
        <Text>Root content not found</Text>
      )}
    </Box>
  )
}

export default ImportExport

import { format } from 'date-fns'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Header from '~common/Header'
import Snackbar from '~common/SnackBar'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'
import { importData } from '~redux/modules/user'
import { autoBackupManager, BackupInfo } from '~helpers/AutoBackupManager'

const ImportExport = () => {
  const { t } = useTranslation()

  return (
    <Container>
      <Header hasBackButton title={t('app.importexport')} />
      <ScrollView style={{ flex: 1 }}>
        <Box mt={20} paddingHorizontal={20}>
          <Text fontSize={20} bold>
            💾 {t('backups.title')}
          </Text>
          <Text mt={10} color="quart" fontSize={12}>
            {t('backups.description')}
          </Text>
          <AutoBackupsList />
        </Box>
        <Box mt={40} paddingHorizontal={20}>
          <Text fontSize={20} bold>
            📤 {t('app.export')}
          </Text>
          <Text mt={10} fontSize={12}>
            {t('app.exportDesc')}
          </Text>
          <LastSave />
        </Box>
        <Box mt={40} paddingHorizontal={20}>
          <Text fontSize={20} bold>
            📥 {t('app.import')}
          </Text>
          <Text mt={10} color="quart" fontSize={12}>
            {t('app.importDesc')}
          </Text>
          <ImportSave />
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
          {/* @ts-ignore */}
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
  setLastSave: React.Dispatch<React.SetStateAction<FileSystem.FileInfo | undefined>>
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

    await Sharing.shareAsync(fileUri, { UTI }).catch(error => {
      console.log(error)
    })
  }

  const sync = async () => {
    setIsSyncing(true)

    try {
      const sanitizeUserBible = ({ changelog, studies, ...rest }: any) => rest
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
            .then(async uri => {
              await FileSystem.writeAsStringAsync(uri, json)
            })
            .catch(e => console.log(e))
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
    <Button style={{ width: 130, marginTop: 20 }} reverse small onPress={sync} disabled={isSyncing}>
      <Text fontSize={15}>{isSyncing ? 'Export...' : t('app.export')}</Text>
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
    <Button style={{ width: 130, marginTop: 20 }} reverse small onPress={importSave}>
      <Text fontSize={15}>{t('app.import')}</Text>
    </Button>
  )
}

const AutoBackupsList = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  useEffect(() => {
    loadBackups()
  }, [])

  const loadBackups = async () => {
    setIsLoading(true)
    try {
      const backupList = await autoBackupManager.listBackups()
      setBackups(backupList)
    } catch (error) {
      console.error('Failed to load backups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async (backup: BackupInfo) => {
    if (isRestoring) return

    // Confirmation
    Alert.alert(
      t('backups.restoreTitle'),
      t('backups.restoreMessage', {
        date: format(backup.timestamp, 'dd/MM/yyyy HH:mm'),
      }),
      [
        {
          text: t('backups.cancel'),
          style: 'cancel',
        },
        {
          text: t('backups.restore'),
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true)
            try {
              const backupData = await autoBackupManager.restoreBackup(backup.filename)

              if (!backupData) {
                throw new Error('Failed to read backup')
              }

              // Importer les données
              dispatch(importData(backupData.data))

              Snackbar.show(t('backups.restoreSuccess'), 'success')
            } catch (error) {
              console.error('Failed to restore backup:', error)
              Snackbar.show(t('backups.restoreError'), 'danger')
            } finally {
              setIsRestoring(false)
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return <Text mt={10}>{t('backups.loading')}</Text>
  }

  if (backups.length === 0) {
    return (
      <Text mt={10} color="grey" textAlign="center">
        {t('backups.none')}
      </Text>
    )
  }

  return (
    <Box mt={10}>
      <Box row justifyContent="space-between" alignItems="center" mb={10}>
        <Text fontSize={12} color="grey">
          {t('backups.count', { count: backups.length })} -{' '}
          {(backups.reduce((acc, b) => acc + b.size, 0) / 1024).toFixed(0)} KB
        </Text>
        <Button small onPress={loadBackups} disabled={isLoading} style={{ paddingHorizontal: 10 }}>
          <Text fontSize={11}>{isLoading ? '...' : '🔄 ' + t('backups.refresh')}</Text>
        </Button>
      </Box>
      {backups.map(backup => (
        <Box
          key={backup.filename}
          mb={10}
          padding={10}
          backgroundColor="rgba(0,0,0,0.05)"
          borderRadius={5}
        >
          <Text fontSize={14} bold>
            {format(backup.timestamp, 'dd/MM/yyyy à HH:mm:ss')}
          </Text>
          <Text fontSize={12} color="grey" mt={5}>
            {t('backups.size')}: {(backup.size / 1024).toFixed(1)} KB
          </Text>
          {backup.stats && (
            <Text fontSize={11} color="grey" mt={3}>
              {t('backups.studies', { count: backup.stats.studiesCount })} •{' '}
              {t('backups.notes', { count: backup.stats.notesCount })} •{' '}
              {t('backups.highlights', { count: backup.stats.highlightsCount })}
            </Text>
          )}
          <Button
            style={{ width: 100, marginTop: 10 }}
            small
            onPress={() => handleRestore(backup)}
            disabled={isRestoring}
          >
            <Text fontSize={12} opacity={isRestoring ? 0.4 : 1}>
              {t('backups.restore')}
            </Text>
          </Button>
        </Box>
      ))}
    </Box>
  )
}

export default ImportExport

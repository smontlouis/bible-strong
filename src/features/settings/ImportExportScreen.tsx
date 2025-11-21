import { format } from 'date-fns'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { shallowEqual } from 'recompose'
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
        <Box mt={40} paddingHorizontal={20}>
          <Text fontSize={20} bold>
            {t('Backups Automatiques')}
          </Text>
          <Text mt={10} color="quart" fontSize={12}>
            Maximum 10 backups conservés au total. Backups auto limités à 1 par jour (si données changées). Backups logout/erreur/manuels créés sans limite. Permet de récupérer vos données en cas de problème.
          </Text>
          <AutoBackupsList />
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
      'Restaurer le backup',
      `Restaurer ce backup du ${format(backup.timestamp, 'dd/MM/yyyy HH:mm')}? Vos données actuelles seront remplacées.`,
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Restaurer',
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

              Snackbar.show('Backup restauré avec succès', 'success')
            } catch (error) {
              console.error('Failed to restore backup:', error)
              Snackbar.show('Erreur lors de la restauration', 'danger')
            } finally {
              setIsRestoring(false)
            }
          }
        }
      ]
    )
  }

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'auto':
        return 'Automatique'
      case 'logout':
        return 'Avant déconnexion'
      case 'sync_error':
        return 'Erreur sync'
      case 'manual':
        return 'Manuel'
      default:
        return trigger
    }
  }

  if (isLoading) {
    return <Text mt={10}>Chargement...</Text>
  }

  if (backups.length === 0) {
    return <Text mt={10} color="grey">Aucun backup disponible</Text>
  }

  return (
    <Box mt={10}>
      <Text fontSize={12} color="grey" mb={10}>
        {backups.length} backup(s) disponible(s) - {(backups.reduce((acc, b) => acc + b.size, 0) / 1024).toFixed(0)} KB total
      </Text>
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
            Type: {getTriggerLabel(backup.filename.includes('backup_') ? 'auto' : 'manual')} • Taille: {(backup.size / 1024).toFixed(1)} KB
          </Text>
          {backup.stats && (
            <Text fontSize={11} color="grey" mt={3}>
              {backup.stats.studiesCount} études • {backup.stats.notesCount} notes • {backup.stats.highlightsCount} highlights
            </Text>
          )}
          <Button
            style={{ width: 100, marginTop: 10 }}
            small
            onPress={() => handleRestore(backup)}
            disabled={isRestoring}
          >
            <Text fontSize={12} opacity={isRestoring ? 0.4 : 1}>
              Restaurer
            </Text>
          </Button>
        </Box>
      ))}
    </Box>
  )
}

const FileSystemStorageDebug = () => {
  const [storageContent, setStorageContent] = useState<Record<string, string>>(
    {}
  )
  const [isLoading, setIsLoading] = useState(false)

  const loadStorageContent = async () => {
    setIsLoading(true)
    try {
      // Get the file from persistStore/root
      const filePath = `${FileSystem.documentDirectory}persistStore/root`
      const fileInfo = await FileSystem.getInfoAsync(filePath)

      if (fileInfo.exists) {
        try {
          const content = await FileSystem.readAsStringAsync(filePath)
          // Try to parse the JSON content
          try {
            const parsedContent = JSON.parse(content)
            setStorageContent({
              'persistStore/root': JSON.stringify(parsedContent, null, 2),
            })
            console.log('PersistStore content:', parsedContent)
          } catch (parseError) {
            // If parsing fails, just show the raw content
            setStorageContent({ 'persistStore/root': content })
            console.log('PersistStore raw content:', content)
          }
        } catch (readError) {
          console.error('Error reading persistStore file:', readError)
          setStorageContent({})
        }
      } else {
        console.log('PersistStore file does not exist at path:', filePath)
        setStorageContent({})
      }
    } catch (error) {
      console.error('Error loading persistStore content:', error)
      setStorageContent({})
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStorageContent()
  }, [])

  return (
    <Box marginTop={20}>
      {isLoading ? (
        <Text>Loading storage content...</Text>
      ) : Object.keys(storageContent).length > 0 ? (
        Object.entries(storageContent).map(([key, value]) => (
          <Box
            key={key}
            marginTop={10}
            padding={10}
            backgroundColor="rgba(0,0,0,0.05)"
            borderRadius={5}
          >
            <Text bold>{key}</Text>
            <Text fontSize={12} numberOfLines={3} ellipsizeMode="tail">
              {value.length > 100 ? `${value.substring(0, 100)}...` : value}
            </Text>
          </Box>
        ))
      ) : (
        <Text>No storage content found</Text>
      )}
    </Box>
  )
}

export default ImportExport

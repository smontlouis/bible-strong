import { format } from 'date-fns'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform } from 'react-native'
import { useDispatch } from 'react-redux'
import Header from '~common/Header'
import { toast } from 'sonner-native'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { autoBackupManager, BackupInfo } from '~helpers/AutoBackupManager'
import { importData } from '~redux/modules/user'

const AutomaticBackupsScreen = () => {
  const { t } = useTranslation()

  return (
    <Container>
      <Header hasBackButton title={t('backups.title')} />
      <ScrollView style={{ flex: 1 }}>
        <Box paddingHorizontal={20} mt={20}>
          <Text color="quart" fontSize={12}>
            {t('backups.description')}
          </Text>
          <AutoBackupsList />
        </Box>
      </ScrollView>
    </Container>
  )
}

const AutoBackupsList = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isExporting, setIsExporting] = useState<string | null>(null)

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

              dispatch(importData(backupData.data))

              toast.success(t('backups.restoreSuccess'))
            } catch (error) {
              console.error('Failed to restore backup:', error)
              toast.error(t('backups.restoreError'))
            } finally {
              setIsRestoring(false)
            }
          },
        },
      ]
    )
  }

  const handleExport = async (backup: BackupInfo) => {
    if (isExporting) return

    setIsExporting(backup.filename)
    try {
      const backupData = await autoBackupManager.restoreBackup(backup.filename)

      if (!backupData) {
        throw new Error('Failed to read backup')
      }

      const json = JSON.stringify(backupData.data)
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
            .catch(e => console.log('[AutoBackups] Error creating file:', e))
        } else {
          const UTI = 'save.biblestrong'
          await Sharing.shareAsync(fileUri, { UTI }).catch(error => {
            console.log('[AutoBackups] Share error:', error)
          })
        }
      } else {
        const UTI = 'save.biblestrong'
        await Sharing.shareAsync(fileUri, { UTI }).catch(error => {
          console.log('[AutoBackups] Share error:', error)
        })
      }

      toast.success(t('backups.exportSuccess'))
    } catch (error) {
      console.error('Failed to export backup:', error)
      toast.error(t('Une erreur est survenue'))
    } finally {
      setIsExporting(null)
    }
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
          <Text fontSize={11}>{isLoading ? '...' : t('backups.refresh')}</Text>
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
          <Box row mt={10}>
            <Button
              style={{ width: 100, marginRight: 10 }}
              small
              onPress={() => handleRestore(backup)}
              disabled={isRestoring}
            >
              <Text fontSize={12} opacity={isRestoring ? 0.4 : 1}>
                {t('backups.restore')}
              </Text>
            </Button>
            <Button
              style={{ width: 100 }}
              small
              reverse
              onPress={() => handleExport(backup)}
              disabled={isExporting !== null}
            >
              <Text fontSize={12} opacity={isExporting === backup.filename ? 0.4 : 1}>
                {isExporting === backup.filename ? '...' : t('backups.export')}
              </Text>
            </Button>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default AutomaticBackupsScreen

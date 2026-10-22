import { format } from 'date-fns'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { useDispatch } from 'react-redux'
import Header from '~common/Header'
import { toast } from '~helpers/toast'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Card from '~common/ui/Card'
import Container from '~common/ui/Container'
import ListSection from '~common/ui/ListSection'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { autoBackupManager, BackupInfo } from '~helpers/AutoBackupManager'
import { importData } from '~redux/modules/user'
const AutomaticBackupsScreen = () => {
  const { t } = useTranslation()

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title={t('backups.title')} />
      <ScrollView backgroundColor="canvas" style={{ flex: 1 }}>
        <Text className="mx-[24px] mb-[22px] text-[14px] leading-[20px] text-grey">
          {t('backups.description')}
        </Text>
        <AutoBackupsList />
      </ScrollView>
    </Container>
  )
}

const AutoBackupsList = () => {
  const { t } = useTranslation()
  const confirm = useConfirmDialog()
  const dispatch = useDispatch()
  const {
    data: backups = [],
    isPending: isLoading,
    isFetching,
    refetch: loadBackups,
  } = useQuery({
    queryKey: ['automatic-backups'],
    queryFn: () => autoBackupManager.listBackups(),
  })

  const restoreMutation = useMutation({
    networkMode: 'always',
    mutationFn: async (backup: BackupInfo) => {
      const backupData = await autoBackupManager.restoreBackup(backup.filename)
      if (!backupData) throw new Error('Failed to read backup')
      return backupData
    },
    onSuccess: backupData => {
      dispatch(importData(backupData.data))
      toast.success(t('backups.restoreSuccess'))
    },
    onError: error => {
      console.error('Failed to restore backup:', error)
      toast.error(t('backups.restoreError'))
    },
  })

  const handleRestore = async (backup: BackupInfo) => {
    if (restoreMutation.isPending) return
    const confirmed = await confirm({
      title: t('backups.restoreTitle'),
      message: t('backups.restoreMessage', {
        date: format(backup.timestamp, 'dd/MM/yyyy HH:mm'),
      }),
      cancelLabel: t('backups.cancel'),
      confirmLabel: t('backups.restore'),
      destructive: true,
    })
    if (confirmed) restoreMutation.mutate(backup)
  }

  const exportMutation = useMutation({
    networkMode: 'always',
    mutationFn: async (backup: BackupInfo) => {
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
    },
    onSuccess: () => toast.success(t('backups.exportSuccess')),
    onError: error => {
      console.error('Failed to export backup:', error)
      toast.error(t('Une erreur est survenue'))
    },
  })

  const handleExport = (backup: BackupInfo) => {
    if (exportMutation.isPending) return
    exportMutation.mutate(backup)
  }

  if (isLoading) {
    return (
      <Card className="mx-[20px] mb-[22px] p-[16px]">
        <Text className="text-[15px] text-grey text-center">{t('backups.loading')}</Text>
      </Card>
    )
  }

  if (backups.length === 0) {
    return (
      <Card className="mx-[20px] mb-[22px] p-[16px]">
        <Text className="text-[15px] leading-[21px] text-grey text-center">
          {t('backups.none')}
        </Text>
      </Card>
    )
  }

  return (
    <>
      <Box className="flex-row justify-between items-center gap-[12px] ml-[24px] mr-[20px] mb-[9px]">
        <Text className="flex-1 text-[13px] text-grey">
          {t('backups.count', { count: backups.length })} ·{' '}
          {(backups.reduce((acc, b) => acc + b.size, 0) / 1024).toFixed(0)} KB
        </Text>
        <Button
          small
          onPress={() => loadBackups()}
          disabled={isFetching}
          style={{ paddingHorizontal: 10 }}
        >
          <Text className="text-[13px] font-bold text-white">
            {isFetching ? '…' : t('backups.refresh')}
          </Text>
        </Button>
      </Box>
      <ListSection>
        {backups.map(backup => (
          <Box className="px-[14px] py-[12px]" key={backup.filename}>
            <Text className="text-[15px] font-bold">
              {format(backup.timestamp, 'dd/MM/yyyy à HH:mm:ss')}
            </Text>
            <Text className="text-[13px] text-grey mt-[2px]">
              {t('backups.size')}: {(backup.size / 1024).toFixed(1)} KB
            </Text>
            {backup.stats && (
              <Text className="text-[13px] leading-[18px] text-grey mt-[2px]">
                {backup.stats.highlightsCount > 0 &&
                  `${t('backups.highlights', { count: backup.stats.highlightsCount })} • `}
                {backup.stats.notesCount > 0 &&
                  `${t('backups.notes', { count: backup.stats.notesCount })} • `}
                {backup.stats.bookmarksCount > 0 &&
                  `${t('backups.bookmarks', { count: backup.stats.bookmarksCount })} • `}
                {backup.stats.linksCount > 0 &&
                  `${t('backups.links', { count: backup.stats.linksCount })} • `}
                {backup.stats.tagsCount > 0 &&
                  `${t('backups.tags', { count: backup.stats.tagsCount })} • `}
                {backup.stats.studiesCount > 0 &&
                  `${t('backups.studies', { count: backup.stats.studiesCount })} • `}
                {backup.stats.tabsCount > 0 &&
                  `${t('backups.tabs', { count: backup.stats.tabsCount })}`}
              </Text>
            )}
            <Box className="flex-row mt-[12px]">
              <Button
                style={{ width: 100, marginRight: 10 }}
                small
                onPress={() => handleRestore(backup)}
                disabled={restoreMutation.isPending}
              >
                <Text
                  className="text-[13px] font-bold text-white"
                  style={{ opacity: restoreMutation.isPending ? 0.4 : 1 }}
                >
                  {t('backups.restore')}
                </Text>
              </Button>
              <Button
                style={{ width: 100 }}
                small
                reverse
                onPress={() => handleExport(backup)}
                disabled={exportMutation.isPending}
              >
                <Text
                  className="text-[13px] font-bold"
                  style={{
                    opacity:
                      exportMutation.isPending &&
                      exportMutation.variables?.filename === backup.filename
                        ? 0.4
                        : 1,
                  }}
                >
                  {exportMutation.isPending &&
                  exportMutation.variables?.filename === backup.filename
                    ? '...'
                    : t('backups.export')}
                </Text>
              </Button>
            </Box>
          </Box>
        ))}
      </ListSection>
    </>
  )
}

export default AutomaticBackupsScreen

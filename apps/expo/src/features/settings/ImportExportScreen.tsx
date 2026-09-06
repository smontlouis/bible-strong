import { format } from 'date-fns'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { getDefaultStore } from 'jotai/vanilla'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Header from '~common/Header'
import { toast } from '~helpers/toast'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { importData } from '~redux/modules/user'
import { selectUserAndPlan } from '~redux/selectors/plan'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import { tabGroupsAtom, TabGroup } from '~state/tabs'
import { localQueryOptions } from '~helpers/queryOptions'
type ExistingFileInfo = Extract<FileSystem.FileInfo, { exists: true }>
type BackupBibleData = Omit<RootState['user']['bible'], 'changelog' | 'studies'>

/**
 * Nettoie les tab groups pour l'export en supprimant les base64Preview
 */
const sanitizeTabGroupsForBackup = (groups: TabGroup[]): TabGroup[] => {
  return groups.map(group => ({
    ...group,
    tabs: group.tabs.map(tab => ({ ...tab, base64Preview: undefined })),
  }))
}

const ImportExport = () => {
  const { t } = useTranslation()

  return (
    <Container>
      <Header hasBackButton title={t('app.importexport')} />
      <ScrollView style={{ flex: 1 }}>
        <Box className="overflow-hidden border-continuous mt-[20px] px-[20px]">
          <Text className="text-[20px] font-bold">{t('app.export')}</Text>
          <Text className="mt-[10px] text-[12px]">{t('app.exportDesc')}</Text>
          <LastSave />
        </Box>
        <Box className="overflow-hidden border-continuous mt-[40px] px-[20px]">
          <Text className="text-[20px] font-bold">{t('app.import')}</Text>
          <Text className="mt-[10px] text-quart text-[12px]">{t('app.importDesc')}</Text>
          <ImportSave />
        </Box>
      </ScrollView>
    </Container>
  )
}

const LastSave = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const lastSaveKey = ['last-exported-save'] as const
  const { data: lastSave } = useQuery({
    queryKey: lastSaveKey,
    queryFn: async () => {
      const savePath = `${FileSystem.documentDirectory}/save.biblestrong`
      const saveFile = await FileSystem.getInfoAsync(savePath)
      return saveFile.exists ? saveFile : null
    },
    ...localQueryOptions,
  })

  return (
    <Box className="overflow-hidden border-continuous mt-[20px]">
      <Text className="font-bold">{t('app.lastSave')}</Text>
      {lastSave ? (
        <Text className="mt-[5px] text-grey">
          {format((lastSave.modificationTime || 0) * 1000, 'dd/MM/yyyy HH:mm')}
        </Text>
      ) : (
        <Text className="text-grey">{t('app.noSave')}</Text>
      )}
      <ExportButton
        onSaved={file => {
          queryClient.setQueryData(lastSaveKey, file)
        }}
      />
    </Box>
  )
}

const ExportButton = ({ onSaved }: { onSaved: (file: ExistingFileInfo) => void }) => {
  const { t } = useTranslation()

  const [isSyncing, setIsSyncing] = useState(false)
  const { user, plan } = useSelector(selectUserAndPlan)

  const exportAsync = async (json: string) => {
    const fileUri = FileSystem.documentDirectory + 'save.biblestrong'

    const UTI = 'save.biblestrong'

    await Sharing.shareAsync(fileUri, { UTI }).catch(error => {
      console.log('[Settings] Share error:', error)
    })
  }

  const sync = async () => {
    setIsSyncing(true)

    try {
      const sanitizeUserBible = ({
        changelog,
        studies,
        ...rest
      }: RootState['user']['bible']): BackupBibleData => rest

      // Récupérer les tab groups depuis Jotai
      const store = getDefaultStore()
      const tabGroups = store.get(tabGroupsAtom)

      const json = JSON.stringify({
        bible: sanitizeUserBible(user.bible),
        plan: plan.ongoingPlans,
        studies: user.bible.studies,
        tabGroups: sanitizeTabGroupsForBackup(tabGroups),
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
            .catch(e => console.log('[Settings] Error creating file:', e))
        } else {
          await exportAsync(json)
        }
      } else {
        await exportAsync(json)
      }

      const saveFile = await FileSystem.getInfoAsync(fileUri)
      if (saveFile.exists) {
        onSaved(saveFile)
      }
      toast.success(t('app.exported'))
    } catch {
      toast.error(t('Une erreur est survenue'))
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button style={{ width: 130, marginTop: 20 }} reverse small onPress={sync} disabled={isSyncing}>
      <Text className="text-[15px]">{isSyncing ? 'Export...' : t('app.export')}</Text>
    </Button>
  )
}

const ImportSave = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()

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
        toast.success(t('app.imported'))
      }
    } catch (error) {
      console.log('[Settings] Import error:', error)
      toast.error(t('Une erreur est survenue'))
    }
  }

  return (
    <Button style={{ width: 130, marginTop: 20 }} reverse small onPress={importSave}>
      <Text className="text-[15px]">{t('app.import')}</Text>
    </Button>
  )
}

export default ImportExport

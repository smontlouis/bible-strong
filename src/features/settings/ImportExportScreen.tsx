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
          {format((lastSave.modificationTime || 0) * 1000, 'dd/MM/yyyy HH:mm')}
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

  const sync = async () => {
    setIsSyncing(true)

    try {
      const sanitizeUserBible = ({ changelog, studies, ...rest }) => rest
      const fileUri = FileSystem.documentDirectory + 'save.biblestrong'

      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify({
          bible: sanitizeUserBible(user.bible),
          plan: plan.ongoingPlans,
          studies: user.bible.studies,
        }),
        {
          encoding: FileSystem.EncodingType.UTF8,
        }
      )

      const UTI = 'save.biblestrong'

      await Sharing.shareAsync(fileUri, { UTI }).catch(error => {
        console.log(error)
      })

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
      const file = await DocumentPicker.getDocumentAsync()

      if (file.type === 'success') {
        const save = await FileSystem.readAsStringAsync(file.uri)

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

export default ImportExport

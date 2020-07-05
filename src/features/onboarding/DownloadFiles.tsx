import React, { useState } from 'react'
import { ScrollView, Alert } from 'react-native'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'
import {
  getVersionsBySections,
  getIfVersionNeedsDownload,
} from '~helpers/bibleVersions'
import SectionList from '~common/ui/SectionList'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import Paragraph from '~common/ui/Paragraph'
import DBSelectorItem from '~features/settings/DatabaseSelectorItem'
import { databases } from '~helpers/databases'
import { wp } from '~helpers/utils'
import { setFirstTime } from '~redux/modules/user'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'

const DownloadFiles = ({
  setStep,
}: {
  setStep: React.Dispatch<React.SetStateAction<number>>
}) => {
  const [allDownloadFunc, setAllDownloadFunc] = useState<(() => void)[]>([])
  const { t } = useTranslation()
  const isFR = useLanguage()
  const addDownloadFunc = (fn: () => void) =>
    setAllDownloadFunc(fns => [...fns, fn])
  const dispatch = useDispatch()

  const onConfirmDownload = () => {
    Alert.alert(
      t('Attention'),
      t(
        "Vous êtes sur le point de télécharger toutes les bases de données et bibles, assurez-vous d'avoir assez d'espace.\n\n Restez sur cette page jusqu'à la fin de tous les téléchargements."
      ),
      [
        { text: t('Annuler'), onPress: () => null, style: 'cancel' },
        {
          text: t('Confirmer'),
          onPress: () => {
            allDownloadFunc.map((fn, i) => setTimeout(() => fn(), i * 200))
          },
          style: 'destructive',
        },
      ]
    )
  }

  const checkForVersion = async () => {
    const lsgNeedsDownload = await getIfVersionNeedsDownload(
      isFR ? 'LSG' : 'KJV'
    )
    if (lsgNeedsDownload) {
      Alert.alert(
        t('LSG manquante'),
        t('La version LSG doit être téléchargée pour commencer.')
      )
      return
    }

    dispatch(setFirstTime(false))
  }

  return (
    <Container>
      <SectionList
        ListHeaderComponent={
          <>
            <Box width={wp(85)} pt={30}>
              <Text padding={20} title fontSize={30}>
                {t('Vous êtes presque prêt !')}
              </Text>
              <Paragraph fontFamily="text" px={20}>
                {t(
                  'Choisissez les bases de données et les bibles que vous souhaitez télécharger.'
                )}
              </Paragraph>
              <Paragraph fontFamily="text" color="quart" px={20}>
                {t('La LSG est obligatoire pour commencer.')}
              </Paragraph>
            </Box>
            <Box padding={20}>
              <Button onPress={onConfirmDownload}>
                {t('Tout télécharger')}
              </Button>
            </Box>
            <Text padding={20} title fontSize={25}>
              {t('Bases de données')}
            </Text>
            {Object.values(databases).map(db => (
              <DBSelectorItem
                key={db.id}
                database={db.id}
                name={db.name}
                subTitle={db.desc}
                fileSize={db.fileSize}
                path={db.path}
                shareFn={addDownloadFunc}
              />
            ))}

            <Text padding={20} paddingBottom={0} title fontSize={25}>
              {t('Bibles')}
            </Text>
          </>
        }
        stickySectionHeadersEnabled={false}
        sections={getVersionsBySections()}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Box paddingHorizontal={20} marginTop={20}>
            <Text fontSize={16} color="tertiary">
              {title}
            </Text>
            <Border marginTop={10} />
          </Box>
        )}
        renderItem={({ item }) => (
          <VersionSelectorItem
            version={item}
            shareFn={addDownloadFunc}
            isParameters
          />
        )}
      />
      <Box padding={20}>
        <Button success onPress={checkForVersion}>
          {t('Continuer')}
        </Button>
      </Box>
    </Container>
  )
}

export default DownloadFiles

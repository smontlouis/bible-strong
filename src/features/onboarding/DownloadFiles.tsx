import React, { useState } from 'react'
import { Alert } from 'react-native'
import RNRestart from 'react-native-restart'
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
import { getDatabases } from '~helpers/databases'
import { wp, hp } from '~helpers/utils'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'
import { FeatherIcon } from '~common/ui/Icon'

const DownloadFiles = ({
  setStep,
  setFirstTime,
}: {
  setStep: React.Dispatch<React.SetStateAction<number>>
  setFirstTime: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const [allDownloadFunc, setAllDownloadFunc] = useState<(() => void)[]>([])
  const { t } = useTranslation()
  const isFR = useLanguage()
  const addDownloadFunc = (fn: () => void) =>
    setAllDownloadFunc(fns => [...fns, fn])

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

    setFirstTime(false)
    RNRestart.Restart()
  }

  return (
    <Container>
      <SectionList
        ListHeaderComponent={
          <>
            <Box height={hp(100)} paddingTop={100} paddingBottom={30}>
              <Box width={wp(85)}>
                <Text padding={20} title fontSize={40}>
                  {t('Vous êtes presque prêt !')}
                </Text>
              </Box>
              <Box width={wp(85)}>
                <Paragraph fontFamily="text" px={20} mt={40}>
                  {t(
                    'Choisissez les bases de données et les bibles que vous souhaitez télécharger.'
                  )}
                </Paragraph>
                <Paragraph fontFamily="text" color="quart" px={20}>
                  {t('La LSG est obligatoire pour commencer.')}
                </Paragraph>
              </Box>
              <Box center style={{ marginTop: 'auto' }}>
                <Text mb={10}>{t('Scroll Down')}</Text>
                <FeatherIcon name="arrow-down" size={40} />
              </Box>
            </Box>
            <Box px={20} mt={20} paddingBottom={10}>
              <Button reverse onPress={onConfirmDownload}>
                {t('Tout télécharger')}
              </Button>
            </Box>
            <Text padding={20} title fontSize={25}>
              {t('Bases de données')}
            </Text>
            {Object.values(getDatabases()).map(db => (
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
        ListFooterComponent={
          <Box padding={20}>
            <Button success onPress={checkForVersion}>
              {t('Continuer')}
            </Button>
          </Box>
        }
      />
    </Container>
  )
}

export default DownloadFiles

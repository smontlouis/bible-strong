import React from 'react'

import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import SectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import { getVersionsBySections } from '~helpers/bibleVersions'
import { getDatabases } from '~helpers/databases'
import DBSelectorItem from './DatabaseSelectorItem'
import useLanguage from '~helpers/useLanguage'

const DLScreen = () => {
  const { t } = useTranslation()
  const isFr = useLanguage()
  const databases = Object.values(getDatabases()).filter(db =>
    !isFr ? db.id !== 'MHY' : true
  )

  return (
    <Container>
      <Header hasBackButton title={t('Gestion des téléchargements')} />
      <SectionList
        ListHeaderComponent={
          <>
            <Text padding={20} title fontSize={25}>
              {t('Bases de données')}
            </Text>
            <Paragraph padding={20} paddingTop={0} scale={-3}>
              {t(
                "Si votre base de données a été corrompue, pensez à redémarrer l'application une fois les fichiers téléchargés."
              )}
            </Paragraph>
            {databases.map(db => (
              <DBSelectorItem
                key={db.id}
                database={db.id}
                name={db.name}
                subTitle={db.desc}
                fileSize={db.fileSize}
                path={db.path}
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
          <VersionSelectorItem isParameters version={item} />
        )}
      />
    </Container>
  )
}
export default DLScreen

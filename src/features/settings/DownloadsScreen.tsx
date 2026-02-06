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
import { databases } from '~helpers/databases'
import { LANGUAGE_SPECIFIC_DBS, SHARED_DBS, FRENCH_ONLY_DBS } from '~helpers/databaseTypes'
import type { ResourceLanguage, DatabaseId } from '~helpers/databaseTypes'
import DBSelectorItem from './DatabaseSelectorItem'

// Get databases for a specific language, excluding shared ones
const getLanguageSpecificDatabases = (lang: ResourceLanguage) => {
  const allDbs = databases(lang)
  return LANGUAGE_SPECIFIC_DBS.filter(dbId => dbId !== 'INTERLINEAIRE') // Interlineaire shown separately with Bibles (INT/INT_EN)
    .filter(dbId => (lang === 'en' ? !FRENCH_ONLY_DBS.includes(dbId) : true)) // Exclude French-only DBs from English
    .map(dbId => ({
      ...allDbs[dbId as keyof typeof allDbs],
      lang,
    }))
}

// Get shared databases (like TRESOR), excluding internal-only ones (BIBLES)
const getSharedDatabases = () => {
  const allDbs = databases('fr') // Language doesn't matter for shared
  return SHARED_DBS.filter(dbId => dbId in allDbs).map(
    dbId => allDbs[dbId as keyof typeof allDbs]
  )
}

const DLScreen = () => {
  const { t } = useTranslation()

  const frDatabases = getLanguageSpecificDatabases('fr')
  const enDatabases = getLanguageSpecificDatabases('en')
  const sharedDatabases = getSharedDatabases()

  return (
    <Container>
      <Header hasBackButton title={t('Gestion des téléchargements')} />
      <SectionList
        ListHeaderComponent={
          <>
            <Paragraph padding={20} paddingTop={20} scale={-3}>
              {t(
                "Si votre base de données a été corrompue, pensez à redémarrer l'application une fois les fichiers téléchargés."
              )}
            </Paragraph>

            {/* French Databases */}
            <Text padding={20} paddingBottom={10} title fontSize={20}>
              🇫🇷 {t('downloads.databasesFr')}
            </Text>
            {frDatabases.map((db: any) => (
              // @ts-ignore
              <DBSelectorItem
                // @ts-ignore
                key={`${db.id}-fr`}
                // @ts-ignore
                database={db.id}
                name={db.name}
                subTitle={db.desc}
                fileSize={db.fileSize}
                lang="fr"
              />
            ))}

            {/* English Databases */}
            <Text padding={20} paddingBottom={10} paddingTop={30} title fontSize={20}>
              🇺🇸 {t('downloads.databasesEn')}
            </Text>
            {enDatabases.map((db: any) => (
              // @ts-ignore
              <DBSelectorItem
                // @ts-ignore
                key={`${db.id}-en`}
                // @ts-ignore
                database={db.id}
                name={db.name}
                subTitle={db.desc}
                fileSize={db.fileSize}
                lang="en"
              />
            ))}

            {/* Shared Databases */}
            <Text padding={20} paddingBottom={10} paddingTop={30} title fontSize={20}>
              {t('downloads.crossReferences')}
            </Text>
            {sharedDatabases.map((db: any) => (
              // @ts-ignore
              <DBSelectorItem
                // @ts-ignore
                key={db.id}
                // @ts-ignore
                database={db.id}
                name={db.name}
                subTitle={db.desc}
                fileSize={db.fileSize}
                path={db.path}
              />
            ))}

            <Text padding={20} paddingBottom={0} paddingTop={30} title fontSize={25}>
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
        renderItem={({ item }) => <VersionSelectorItem isParameters version={item} />}
      />
    </Container>
  )
}
export default DLScreen

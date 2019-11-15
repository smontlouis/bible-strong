import React from 'react'

import { versionsBySections } from '~helpers/bibleVersions'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Header from '~common/Header'
import DBSelectorItem from './DatabaseSelectorItem'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'

const DLScreen = () => {
  return (
    <Container>
      <Header hasBackButton />
      <ScrollView>
        <Text padding={20} title fontSize={25}>
          Bases de données
        </Text>
        <Paragraph padding={20} paddingTop={0} scale={-3}>
          Si votre base de données a été corrompue, pensez à redémarrer l'application une fois les
          fichiers téléchargés.
        </Paragraph>
        <DBSelectorItem
          database="STRONG"
          name="Lexique hébreu & grec"
          subTitle="Lexique contenu les strongs grecs et hébreu avec leur concordance et définitions"
          fileSize={34941952}
        />
        <DBSelectorItem
          database="DICTIONNAIRE"
          name="Dictionnaire Westphal"
          subTitle="Dictionnaire Encyclopédique de la Bible A. Westphal. "
          fileSize={22532096}
        />
        <DBSelectorItem
          database="NAVE"
          name="Bible thématique Nave"
          subTitle="Plus de 20.000 sujets et sous-thèmes, et 100.000 références aux Écritures."
          fileSize={7448576}
        />
        <DBSelectorItem
          database="SEARCH"
          name="Index de recherche"
          subTitle="Index permettant une recherche avancée dans la Bible"
          fileSize={16795170}
        />
        <DBSelectorItem
          database="TRESOR"
          name="Références croisées"
          subTitle="L’un des ensembles les plus complets de références croisées jamais compilées, composé de plus de 572.000 entrées."
          fileSize={5434368}
        />
        <DBSelectorItem
          database="MHY"
          name="Commentaires"
          subTitle="Commentaires concis de Matthew Henry. Traduction Dominique Osché."
          fileSize={6574080}
        />
        <Text padding={20} paddingBottom={0} title fontSize={25}>
          Bibles
        </Text>
        <SectionList
          stickySectionHeadersEnabled={false}
          sections={versionsBySections}
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
      </ScrollView>
    </Container>
  )
}
export default DLScreen

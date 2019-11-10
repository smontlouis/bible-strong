import React from 'react'

import { versions } from '~helpers/bibleVersions'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Header from '~common/Header'
import DBSelectorItem from './DatabaseSelectorItem'
import VersionSelectorItem from './VersionSelectorItem'

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
        <DBSelectorItem database="SEARCH" name="Index de recherche" fileSize={16795170} />
        <DBSelectorItem
          database="TRESOR"
          name="Références croisées"
          subTitle="Les Trésor de la connaissance des Écritures est l’un des ensembles les plus complets de références croisées jamais compilées, composé de plus de 572.000 entrées."
          fileSize={5434368}
        />
        <DBSelectorItem
          database="MHY"
          name="Commentaires"
          subTitle="Commentaires concis de Matthew Henry. Traduction Dominique Osché."
          fileSize={6574080}
        />
        <DBSelectorItem
          database="NAVE"
          name="Bible thématique Nave"
          subTitle="Naves Topical Bible se compose de plus de 20.000 sujets et sous-thèmes, et 100.000 références aux Écritures."
          fileSize={7448576}
        />
        <Text padding={20} title fontSize={25}>
          Bibles
        </Text>
        {Object.values(versions)
          .filter(v => v.id !== 'LSG')
          .map(version => (
            <VersionSelectorItem key={version.id} version={version} />
          ))}
      </ScrollView>
    </Container>
  )
}
export default DLScreen

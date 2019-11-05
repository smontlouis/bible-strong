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
        <DBSelectorItem database="STRONG" name="Lexique hébreu & grec" fileSize={34941952} />
        <DBSelectorItem database="DICTIONNAIRE" name="Dictionnaire Westphal" fileSize={22532096} />
        <DBSelectorItem database="SEARCH" name="Index de recherche" fileSize={16795170} />
        <DBSelectorItem database="TRESOR" name="Trésor de l'écriture" fileSize={5434368} />
        <DBSelectorItem database="MHY" name="Commentaires de Matthew Henry" fileSize={6574080} />
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

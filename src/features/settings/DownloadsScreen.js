import React, { useEffect } from 'react'
import { Linking, ScrollView } from 'react-native'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import { versions } from '~helpers/bibleVersions'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import DBSelectorItem from './DatabaseSelectorItem'
import VersionSelectorItem from './VersionSelectorItem'

const DLScreen = () => {
  return (
    <Container>
      <Header hasBackButton title="Gestion des téléchargements" />
      <ScrollView>
        <Text padding={10} title fontSize={25}>
          Bases de données
        </Text>
        <DBSelectorItem database="STRONG" name="Lexique hébreu & grec" fileSize={34941952} />
        <DBSelectorItem database="DICTIONNAIRE" name="Dictionnaire Westphal" fileSize={22532096} />
        <DBSelectorItem database="SEARCH" name="Index de recherche" fileSize={16795170} />
        <Text padding={10} title fontSize={25}>
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

import React, { useState } from 'react'
import { Alert } from 'react-native'

import { versionsBySections } from '~helpers/bibleVersions'
import { databases } from '~helpers/databases'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Button from '~common/ui/Button'
import Header from '~common/Header'
import DBSelectorItem from './DatabaseSelectorItem'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'

const DLScreen = () => {
  const [allDownloadFunc, setAllDownloadFunc] = useState([])
  const addDownloadFunc = fn => setAllDownloadFunc(fns => [...fns, fn])

  const onConfirmDownload = () => {
    Alert.alert(
      'Attention',
      "Vous êtes sur le point de télécharger toutes les bases de données et bibles, assurez-vous d'avoir assez d'espace.\n\n Restez sur cette page jusqu'à la fin de tous les téléchargements.",
      [
        { text: 'Annuler', onPress: () => null, style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            allDownloadFunc.map((fn, i) => setTimeout(() => fn(), i * 200))
          },
          style: 'destructive',
        },
      ]
    )
  }

  return (
    <Container>
      <Header hasBackButton />
      <SectionList
        ListHeaderComponent={
          <>
            <Text padding={20} title fontSize={25}>
              Bases de données
            </Text>
            <Paragraph padding={20} paddingTop={0} scale={-3}>
              Si votre base de données a été corrompue, pensez à redémarrer
              l'application une fois les fichiers téléchargés.
            </Paragraph>
            <Box padding={20}>
              <Button onPress={onConfirmDownload}>Tout télécharger</Button>
            </Box>
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
              Bibles
            </Text>
          </>
        }
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
        renderItem={({ item }) => (
          <VersionSelectorItem
            isParameters
            version={item}
            shareFn={addDownloadFunc}
          />
        )}
      />
    </Container>
  )
}
export default DLScreen

import React from 'react'
import { connect } from 'react-redux'
import styled from '@emotion/native'

import Container from '~common/ui/Container'
import RNSectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Header from '~common/Header'
import * as BibleActions from '~redux/modules/bible'
import { versionsBySections } from '~helpers/bibleVersions'

import VersionSelectorItem from './VersionSelectorItem'

const SectionList = styled(RNSectionList)({
  flex: 1,
  paddingTop: 10,
  paddingBottom: 20
})

const setAndClose = (setVersion, navigation, vers) => {
  setVersion(vers)
  navigation.goBack()
}

const VersionSelector = ({ setVersion, navigation }) => {
  return (
    <Container>
      <Header hasBackButton title="Version" />
      <SectionList
        contentContainerStyle={{ paddingTop: 0 }}
        stickySectionHeadersEnabled={false}
        sections={versionsBySections}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Box paddingHorizontal={20} marginTop={30}>
            <Text fontSize={16} color="tertiary">
              {title}
            </Text>
            <Border marginTop={10} />
          </Box>
        )}
        renderItem={({ item }) => (
          <VersionSelectorItem
            onChange={vers => setAndClose(setVersion, navigation, vers)}
            version={item}
            isSelected={item.id === navigation.state.params.version}
          />
        )}
      />
    </Container>
  )
}

VersionSelector.navigationOptions = {
  headerTitle: 'Versions',
  headerTintColor: '#000',
  headerStyle: { borderBottomWidth: 0 }
}

export default connect(
  null,
  BibleActions
)(VersionSelector)

import React from 'react'
import { connect } from 'react-redux'
import styled from '@emotion/native'

import Container from '~common/ui/Container'
import Header from '~common/Header'
import * as BibleActions from '~redux/modules/bible'
import { versions } from '~helpers/bibleVersions'

import VersionSelectorItem from './VersionSelectorItem'

const FlatList = styled.FlatList({
  flex: 1,
  paddingTop: 10,
  paddingBottom: 20
})

const setAndClose = (setVersion, navigation, vers) => {
  setVersion(vers)
  navigation.goBack()
}

const VersionSelector = ({ setVersion, navigation }) => (
  <Container>
    <Header hasBackButton title='Version' />
    <FlatList
      data={Object.values(versions)}
      keyExtractor={(item, index) => item.id}
      renderItem={({ item }: any) => (
        <VersionSelectorItem
          onChange={vers => setAndClose(setVersion, navigation, vers)}
          version={item}
          isSelected={item.id === navigation.state.params.version}
        />
      )}
    />
  </Container>
)

VersionSelector.navigationOptions = {
  headerTitle: 'Versions',
  headerTintColor: '#000',
  headerStyle: { borderBottomWidth: 0 }
}

export default connect(
  null,
  BibleActions
)(VersionSelector)

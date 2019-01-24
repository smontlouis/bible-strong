import React from 'react'
import { connect } from 'react-redux'
import styled from '@emotion/native'

import * as BibleActions from '@modules/bible'

import Container from '@ui/Container'
import Header from '@components/Header'
import VersionSelectorItem from '@components/VersionSelectorItem'

const FlatList = styled.FlatList({
  flex: 1,
  paddingTop: 10,
  paddingBottom: 20
})

const versions = {
  LSG: {
    id: 'LSG',
    name: 'Bible Second 1910'
  },
  FRDBY: {
    id: 'FRDBY',
    name: 'Bible Darby en français'
  },
  OST: {
    id: 'OST',
    name: 'Ostervald'
  }
}

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

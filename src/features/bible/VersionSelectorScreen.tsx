import styled from '@emotion/native'
import React from 'react'

import Header from '~common/Header'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import RNSectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import { getVersionsBySections } from '~helpers/bibleVersions'

import { StackScreenProps } from '@react-navigation/stack'
import { useBibleTabActions, VersionCode } from '../../state/tabs'
import VersionSelectorItem from './VersionSelectorItem'
import { useAtomValue } from 'jotai/react'
import { MainStackProps } from '~navigation/type'

const SectionList = styled(RNSectionList)({
  flex: 1,
  paddingTop: 10,
  paddingBottom: 20,
})

const VersionSelector = ({
  navigation,
  route
}: StackScreenProps<MainStackProps, 'VersionSelector'>) => {
  const bibleAtom = route.params.bibleAtom// navigation.getParam('bibleAtom')
  const parallelVersionIndex = route.params.parallelVersionIndex// navigation.getParam('parallelVersionIndex')

  if (!bibleAtom) {
    throw new Error('bibleAtom is required')
  }

  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const setAndClose = (vers: VersionCode, index: number) => {
    if (parallelVersionIndex === undefined) {
      actions.setSelectedVersion(vers)
    } else {
      actions.setParallelVersion(vers, index)
    }
    navigation.goBack()
  }
  return (
    <Container>
      <Header hasBackButton title="Version" />
      <SectionList
        contentContainerStyle={{ paddingTop: 0 }}
        stickySectionHeadersEnabled={false}
        sections={getVersionsBySections()}
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
            onChange={vers => setAndClose(vers, parallelVersionIndex)} // TODO : should type check this
            version={item}
            isSelected={
              item.id ===
              (parallelVersionIndex === undefined
                ? bible.data.selectedVersion
                : bible.data.parallelVersions[parallelVersionIndex])
            }
          />
        )}
      />
    </Container>
  )
}

VersionSelector.navigationOptions = {
  headerTitle: 'Versions',
  headerTintColor: '#000',
  headerStyle: { borderBottomWidth: 0 },
}

export default VersionSelector

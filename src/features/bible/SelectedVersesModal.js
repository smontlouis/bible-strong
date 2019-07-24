import React from 'react'
import { Share } from 'react-native'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

import getVersesRef from '~helpers/getVersesRef'
import TouchableCircle from './TouchableCircle'
import TouchableIcon from './TouchableIcon'

const StylizedModal = styled(Modal)({
  backgroundColor: 'transparent',
  height: 140,
  flexDirection: 'row',
  justifyContent: 'center',
  paddingBottom: 20
})

const Container = styled.View(({ theme }) => ({
  width: 230,
  height: 120,
  backgroundColor: theme.colors.reverse,
  borderRadius: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  alignItems: 'stretch',
  justifyContent: 'space-between'
}))

const HalfContainer = styled.View(({ border, theme }) => ({
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  alignItems: 'stretch',
  height: 60
}))

const VersesModal = ({
  isVisible,
  isSelectedVerseHighlighted,
  addHighlight,
  removeHighlight,
  clearSelectedVerses,
  navigation,
  selectedVerses,
  setSelectedVerse,
  version,
  theme,
  onCreateNoteClick
}) => {
  const shareVerse = async () => {
    const { all: message } = await getVersesRef(selectedVerses, version)
    const result = await Share.share({ message })
    // Clear selectedverses only if succeed
    if (result.action === Share.sharedAction) {
      clearSelectedVerses()
    }
  }

  const showStrongDetail = () => {
    clearSelectedVerses()
    let verse = Object.keys(selectedVerses)[0].split('-')[2]
    setSelectedVerse(verse)
    navigation.navigate('BibleVerseDetail')
  }

  const compareVerses = () => {
    clearSelectedVerses()
    navigation.navigate('BibleCompareVerses', {
      selectedVerses
    })
  }

  return (
    <StylizedModal
      isOpen={isVisible}
      animationDuration={200}
      position='bottom'
      backdrop={false}
      backdropPressToClose={false}
      swipeToClose={false}
    >
      <Container>
        <HalfContainer border>
          <TouchableCircle color={theme.colors.color1} onPress={() => addHighlight('color1')} />
          <TouchableCircle color={theme.colors.color2} onPress={() => addHighlight('color2')} />
          <TouchableCircle color={theme.colors.color3} onPress={() => addHighlight('color3')} />
          <TouchableCircle color={theme.colors.color4} onPress={() => addHighlight('color4')} />
          {
            isSelectedVerseHighlighted &&
            <TouchableIcon name='x-circle' onPress={removeHighlight} />
          }
        </HalfContainer>
        <HalfContainer>
          {
            Object.keys(selectedVerses).length <= 1 &&
            <TouchableIcon
              name='eye'
              color={theme.colors.primary}
              onPress={showStrongDetail}
            />
          }
          <TouchableIcon name='layers' onPress={compareVerses} />
          <TouchableIcon name='file-plus' onPress={onCreateNoteClick} />
          <TouchableIcon name='share-2' onPress={shareVerse} />
          <TouchableIcon name='arrow-down' onPress={clearSelectedVerses} />
        </HalfContainer>

      </Container>
    </StylizedModal>
  )
}

export default withTheme(VersesModal)

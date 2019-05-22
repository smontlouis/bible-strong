import React from 'react'
import { Share } from 'react-native'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'

import theme from '~themes/default'
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

const Container = styled.View({
  width: 200,
  height: 120,
  backgroundColor: 'white',
  borderRadius: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  alignItems: 'stretch',
  justifyContent: 'space-between'
})

const HalfContainer = styled.View(({ border, theme }) => ({
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  justifyContent: 'space-around',
  alignItems: 'center',
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
  setSelectedVerse
}) => {
  return (
    <StylizedModal
      isOpen={isVisible}
      animationDuration={200}
      position='bottom'
      backdrop={false}
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
          <TouchableIcon name='eye' />
          <TouchableIcon name='file' />
          <TouchableIcon name='share-2' onPress={() => Share.share({ message: getVersesRef(selectedVerses) })} />
          {
            Object.keys(selectedVerses).length <= 1 &&
            <TouchableIcon name='arrow-right' onPress={() => {
              clearSelectedVerses()
              let verse = Object.keys(selectedVerses)[0].split('-')[2]
              setSelectedVerse(verse)
              navigation.navigate('BibleVerseDetail')
            }} />
          }
        </HalfContainer>

      </Container>
    </StylizedModal>
  )
}

export default VersesModal

import React, { useState, useEffect } from 'react'
import { Share } from 'react-native'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

import LexiqueIcon from '~common/LexiqueIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import Text from '~common/ui/Text'
import getVersesRef from '~helpers/getVersesRef'
import { cleanParams } from '~helpers/utils'

import TouchableCircle from './TouchableCircle'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'

const StylizedModal = styled(Modal)(({ isSelectionMode }) => ({
  backgroundColor: 'transparent',
  height: 140,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'flex-end',
  paddingBottom: 20,

  ...(isSelectionMode && {
    height: 70,
    width: 250
  })
}))

const Container = styled.View(({ theme, isSelectionMode }) => ({
  width: 260,
  height: isSelectionMode ? 40 : 120,
  backgroundColor: theme.colors.reverse,
  borderRadius: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  alignItems: 'stretch',
  justifyContent: 'space-between',

  ...(isSelectionMode && {
    width: 250,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 10,
    paddingRight: 10
  })
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
  version,
  theme,
  onCreateNoteClick,
  isSelectionMode
}) => {
  const [selectedVersesTitle, setSelectedVersesTitle] = useState('')

  useEffect(() => {
    getVersesRef(selectedVerses, version).then(({ title }) => setSelectedVersesTitle(title))
  }, [selectedVerses, version])

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
    const [Livre, Chapitre, Verset] = Object.keys(selectedVerses)[0].split('-')
    navigation.navigate({
      routeName: 'BibleVerseDetail',
      params: {
        verse: {
          Livre,
          Chapitre,
          Verset
        }
      },
      key: `bible-verse-detail-${Livre}-${Chapitre}-${Verset}`
    })
  }

  const showDictionnaryDetail = () => {
    clearSelectedVerses()
    const [Livre, Chapitre, Verset] = Object.keys(selectedVerses)[0].split('-')
    navigation.navigate({
      routeName: 'DictionnaireVerseDetail',
      params: {
        verse: {
          Livre,
          Chapitre,
          Verset
        }
      },
      key: `dictionnaire-verse-detail-${Livre}-${Chapitre}-${Verset}`
    })
  }

  const compareVerses = () => {
    clearSelectedVerses()
    navigation.navigate('BibleCompareVerses', {
      selectedVerses
    })
  }

  const sendVerseData = async () => {
    const { title, content } = await getVersesRef(selectedVerses, version)
    navigation.navigate('EditStudy', {
      ...cleanParams(),
      type: isSelectionMode,
      title,
      content,
      version,
      verses: Object.keys(selectedVerses)
    })
    clearSelectedVerses()
  }

  return (
    <StylizedModal
      isOpen={isVisible}
      animationDuration={200}
      position="bottom"
      backdrop={false}
      backdropPressToClose={false}
      swipeToClose={false}
      isSelectionMode={isSelectionMode}>
      {isSelectionMode ? (
        <Container isSelectionMode={isSelectionMode}>
          <TouchableIcon
            name="x"
            onPress={clearSelectedVerses}
            color={theme.colors.reverse}
            noFlex
          />
          <Text flex bold fontSize={15} textAlign="center" color="reverse">
            {selectedVersesTitle.toUpperCase()}
          </Text>
          <TouchableIcon
            name="arrow-right"
            color={theme.colors.reverse}
            onPress={sendVerseData}
            noFlex
          />
        </Container>
      ) : (
        <Container>
          <HalfContainer border>
            <TouchableCircle color={theme.colors.color1} onPress={() => addHighlight('color1')} />
            <TouchableCircle color={theme.colors.color2} onPress={() => addHighlight('color2')} />
            <TouchableCircle color={theme.colors.color3} onPress={() => addHighlight('color3')} />
            <TouchableCircle color={theme.colors.color4} onPress={() => addHighlight('color4')} />
            {isSelectedVerseHighlighted && (
              <TouchableIcon name="x-circle" onPress={removeHighlight} />
            )}
          </HalfContainer>
          <HalfContainer>
            {Object.keys(selectedVerses).length <= 1 && (
              <>
                <TouchableSvgIcon icon={LexiqueIcon} color="primary" onPress={showStrongDetail} />
                <TouchableSvgIcon
                  icon={DictionnaireIcon}
                  color="secondary"
                  onPress={showDictionnaryDetail}
                />
              </>
            )}
            <TouchableIcon name="layers" onPress={compareVerses} />
            <TouchableIcon name="file-plus" onPress={onCreateNoteClick} />
            <TouchableIcon name="share-2" onPress={shareVerse} />
            <TouchableIcon name="arrow-down" onPress={clearSelectedVerses} />
          </HalfContainer>
        </Container>
      )}
    </StylizedModal>
  )
}

export default withTheme(VersesModal)

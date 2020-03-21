import React, { useState, useEffect } from 'react'
import { Share } from 'react-native'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'
import { useSelector } from 'react-redux'

import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import Text from '~common/ui/Text'
import getVersesRef from '~helpers/getVersesRef'
import { cleanParams } from '~helpers/utils'

import TouchableCircle from './TouchableCircle'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'
import verseToReference from '../../helpers/verseToReference'

const StylizedModal = styled(Modal)(({ isSelectionMode }) => ({
  height: 200,
  maxWidth: 400,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'flex-end',
  zIndex: 10,
  backgroundColor: 'transparent',

  ...(isSelectionMode && {
    height: 70,
    width: 250
  })
}))

const Container = styled.View(({ theme, isSelectionMode }) => ({
  width: '100%',
  height: isSelectionMode ? 40 : 'auto',
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  alignItems: 'stretch',
  paddingBottom: 15,

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
  onCreateNoteClick,
  isSelectionMode,
  setReference,
  setNave
}) => {
  const [selectedVersesTitle, setSelectedVersesTitle] = useState('')

  const { colors } = useSelector(state => ({
    colors: state.user.bible.settings.colors[state.user.bible.settings.theme]
  }))

  useEffect(() => {
    const title = verseToReference(selectedVerses)
    setSelectedVersesTitle(title)
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

  const onOpenReferences = () => {
    const reference = Object.keys(selectedVerses)[0]
    setReference(reference)
  }

  const onOpenNave = () => {
    const reference = Object.keys(selectedVerses)[0]
    setNave(reference)
  }

  const moreThanOneVerseSelected = Object.keys(selectedVerses).length > 1

  return (
    <StylizedModal
      isOpen={isVisible}
      animationDuration={200}
      position="bottom"
      backdrop={false}
      backdropPressToClose={false}
      swipeToClose={false}
      isSelectionMode={isSelectionMode}
    >
      {isSelectionMode ? (
        <Container isSelectionMode={isSelectionMode}>
          <TouchableIcon
            name="x"
            onPress={clearSelectedVerses}
            color="reverse"
            noFlex
          />
          <Text flex bold fontSize={15} textAlign="center" color="reverse">
            {selectedVersesTitle.toUpperCase()}
          </Text>
          <TouchableIcon
            name="arrow-right"
            color="reverse"
            onPress={sendVerseData}
            noFlex
          />
        </Container>
      ) : (
        <Container>
          <HalfContainer border>
            <TouchableCircle
              color={colors.color1}
              onPress={() => addHighlight('color1')}
            />
            <TouchableCircle
              color={colors.color2}
              onPress={() => addHighlight('color2')}
            />
            <TouchableCircle
              color={colors.color3}
              onPress={() => addHighlight('color3')}
            />
            <TouchableCircle
              color={colors.color4}
              onPress={() => addHighlight('color4')}
            />
            <TouchableCircle
              color={colors.color5}
              onPress={() => addHighlight('color5')}
            />
            {isSelectedVerseHighlighted && (
              <TouchableIcon name="x-circle" onPress={removeHighlight} />
            )}
          </HalfContainer>
          <HalfContainer>
            <TouchableSvgIcon
              icon={LexiqueIcon}
              color="primary"
              onPress={showStrongDetail}
              label="Lexique"
              disabled={moreThanOneVerseSelected}
            />
            <TouchableSvgIcon
              icon={DictionnaireIcon}
              color="secondary"
              onPress={showDictionnaryDetail}
              label="Dictionnaire"
              disabled={moreThanOneVerseSelected}
            />
            <TouchableSvgIcon
              icon={NaveIcon}
              color="quint"
              onPress={onOpenNave}
              label="Thèmes"
              disabled={moreThanOneVerseSelected}
            />
            <TouchableSvgIcon
              icon={RefIcon}
              color="quart"
              onPress={onOpenReferences}
              label="Références"
              disabled={moreThanOneVerseSelected}
            />
          </HalfContainer>
          <HalfContainer>
            <TouchableIcon
              name="layers"
              onPress={compareVerses}
              label="Comparer"
            />
            <TouchableIcon
              name="file-plus"
              onPress={onCreateNoteClick}
              label="Note"
            />
            <TouchableIcon
              name="share-2"
              onPress={shareVerse}
              label="Partager"
            />
            <TouchableIcon
              name="x"
              onPress={clearSelectedVerses}
              label="Annuler"
            />
          </HalfContainer>
        </Container>
      )}
    </StylizedModal>
  )
}

export default VersesModal

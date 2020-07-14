import React, { useState, useEffect } from 'react'
import { Share, ScrollView } from 'react-native'
import { Modalize } from 'react-native-modalize'
import styled from '@emotion/native'
import { useSelector } from 'react-redux'
import Clipboard from '@react-native-community/clipboard'
import { useTheme } from 'emotion-theming'

import SnackBar from '~common/SnackBar'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import getVersesRef from '~helpers/getVersesRef'
import { cleanParams, wp } from '~helpers/utils'
import { usePrevious } from '~helpers/usePrevious'

import TouchableCircle from './TouchableCircle'
import TouchableIcon from './TouchableIcon'
import TouchableChip from './TouchableChip'
import TouchableSvgIcon from './TouchableSvgIcon'
import verseToReference from '../../helpers/verseToReference'
import { useTranslation } from 'react-i18next'

const Container = styled.View(({ theme, isSelectionMode }) => ({
  width: '100%',
  backgroundColor: theme.colors.reverse,
  paddingTop: 10,

  ...(isSelectionMode && {
    flexDirection: 'row',
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 30,
  }),
}))

const HalfContainer = styled.View(({ border, theme }) => ({
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  alignItems: 'stretch',
  height: 60,
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
  setNave,
  selectAllVerses,
}) => {
  const isPrevVisible = usePrevious(isVisible)
  const theme = useTheme()
  const [selectedVersesTitle, setSelectedVersesTitle] = useState('')
  const modalRef = React.useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (isPrevVisible !== isVisible) {
      if (isVisible) {
        modalRef?.current?.open()
      } else {
        modalRef?.current?.close()
      }
    }
  }, [isPrevVisible, isVisible])

  const { colors } = useSelector(state => ({
    colors: state.user.bible.settings.colors[state.user.bible.settings.theme],
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

  const copyToClipboard = async () => {
    const { all: message } = await getVersesRef(selectedVerses, version)
    Clipboard.setString(message)
    SnackBar.show(t('Copié dans le presse-papiers.'))
    clearSelectedVerses()
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
          Verset,
        },
      },
      key: `bible-verse-detail-${Livre}-${Chapitre}-${Verset}`,
    })
  }

  const openCommentariesScreen = () => {
    clearSelectedVerses()
    const verse = Object.keys(selectedVerses)[0]
    navigation.navigate({
      routeName: 'Commentaries',
      params: {
        verse,
      },
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
          Verset,
        },
      },
      key: `dictionnaire-verse-detail-${Livre}-${Chapitre}-${Verset}`,
    })
  }

  const compareVerses = () => {
    clearSelectedVerses()
    navigation.navigate('BibleCompareVerses', {
      selectedVerses,
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
      verses: Object.keys(selectedVerses),
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
    <Modalize
      ref={modalRef}
      onClose={clearSelectedVerses}
      handlePosition="inside"
      handleStyle={{ backgroundColor: theme.colors.default, opacity: 0.5 }}
      modalStyle={{
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: 400,
        width: '100%',

        ...(isSelectionMode && {
          width: 250,
        }),
      }}
      adjustToContentHeight
      withOverlay={false}
    >
      {isSelectionMode ? (
        <Container isSelectionMode={isSelectionMode}>
          <Text paddingTop={20} flex bold fontSize={15} textAlign="center">
            {selectedVersesTitle.toUpperCase()}
          </Text>
          <TouchableIcon
            style={{ paddingTop: 15 }}
            name="arrow-right"
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
              <TouchableIcon
                name="x-circle"
                onPress={() => removeHighlight()}
              />
            )}
          </HalfContainer>
          <HalfContainer>
            <ScrollView
              horizontal
              style={{ overflow: 'visible' }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                paddingVertical: 10,
                overflow: 'visible',
                justifyContent: 'space-around',
              }}
            >
              <Box width={wp(25)}>
                <TouchableSvgIcon
                  icon={LexiqueIcon}
                  color="primary"
                  onPress={showStrongDetail}
                  label={t('Lexique')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
              <Box width={wp(25)}>
                <TouchableSvgIcon
                  icon={DictionnaireIcon}
                  color="secondary"
                  onPress={showDictionnaryDetail}
                  label={t('Dictionnaire')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
              <Box width={wp(25)}>
                <TouchableSvgIcon
                  icon={NaveIcon}
                  color="quint"
                  onPress={onOpenNave}
                  label={t('Thèmes')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
              <Box width={wp(25)}>
                <TouchableSvgIcon
                  icon={RefIcon}
                  color="quart"
                  onPress={onOpenReferences}
                  label={t('Références')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
              {/* <Box width={wp(20)}>
                <TouchableSvgIcon
                  icon={RefIcon}
                  color="quart"
                  onPress={openCommentariesScreen}
                  label={t('Comment.')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box> */}
            </ScrollView>
          </HalfContainer>
          <HalfContainer>
            <ScrollView
              horizontal
              style={{ overflow: 'visible' }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                paddingHorizontal: 20,
                paddingVertical: 10,
                overflow: 'visible',
              }}
            >
              <TouchableChip
                name="layers"
                onPress={compareVerses}
                label={t('Comparer')}
              />
              <TouchableChip
                name="file-plus"
                onPress={onCreateNoteClick}
                label={t('Note')}
              />
              <TouchableChip
                name="copy"
                onPress={copyToClipboard}
                label={t('Copier')}
              />
              <TouchableChip
                name="share-2"
                onPress={shareVerse}
                label={t('Partager')}
              />
              <TouchableChip
                onPress={selectAllVerses}
                label={t('Tout sélectionner')}
              />
            </ScrollView>
          </HalfContainer>
        </Container>
      )}
    </Modalize>
  )
}

export default VersesModal

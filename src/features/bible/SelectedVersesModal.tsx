import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import Clipboard from '@react-native-clipboard/clipboard'
import React, { useEffect, useState } from 'react'
import { ScrollView, Share } from 'react-native'
import { Modalize } from 'react-native-modalize'

import CommentIcon from '~common/CommentIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import getVersesContent from '~helpers/getVersesContent'
import { cleanParams, wp } from '~helpers/utils'

import { useTranslation } from 'react-i18next'
import { useNavigation } from 'react-navigation-hooks'
import { BibleResource, VerseIds } from '~common/types'
import { useShareOptions } from '~features/settings/BibleShareOptionsScreen'
import { useModalize } from '~helpers/useModalize'
import verseToReference from '../../helpers/verseToReference'
import { VersionCode } from '../../state/tabs'
import TouchableChip from './TouchableChip'
import TouchableCircle from './TouchableCircle'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'
import { useAtomValue } from 'jotai/react'
import { openedFromTabAtom } from '~features/studies/atom'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { shallowEqual, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'

const Container = styled.View<{ isSelectionMode?: boolean }>(
  ({ theme, isSelectionMode }) => ({
    width: '100%',
    backgroundColor: theme.colors.reverse,
    paddingTop: 10,

    ...(isSelectionMode && {
      flexDirection: 'row',
      paddingLeft: 10,
      paddingRight: 10,
      paddingVertical: 30,
    }),
  })
)

const HalfContainer = styled.View<{ border?: boolean }>(
  ({ border, theme }) => ({
    borderBottomColor: theme.colors.border,
    borderBottomWidth: border ? 1 : 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 60,
  })
)

type Props = {
  isVisible: boolean
  isSelectionMode: boolean
  isSelectedVerseHighlighted: boolean
  onChangeResourceType: (type: BibleResource) => void
  onCreateNoteClick: () => void
  addHighlight: (color: string) => void
  addTag: () => void
  removeHighlight: () => void
  clearSelectedVerses: () => void
  selectedVerses: VerseIds
  selectAllVerses: () => void
  version: VersionCode
}

const VersesModal = ({
  isVisible,
  isSelectionMode,
  isSelectedVerseHighlighted,
  onChangeResourceType,
  onCreateNoteClick,
  addHighlight,
  addTag,
  removeHighlight,
  clearSelectedVerses,
  selectedVerses,
  selectAllVerses,
  version,
}: Props) => {
  const navigation = useNavigation()
  const theme = useTheme()
  const [selectedVersesTitle, setSelectedVersesTitle] = useState('')
  const { ref, open, close } = useModalize()
  const { t } = useTranslation()
  const openedFromTab = useAtomValue(openedFromTabAtom)

  const { theme: currentTheme } = useCurrentThemeSelector()
  const { colors } = useSelector(
    (state: RootState) => ({
      colors: state.user.bible.settings.colors[currentTheme],
    }),
    shallowEqual
  )

  useEffect(() => {
    if (isVisible) {
      open()
    }
    if (!isVisible) {
      close()
    }
  }, [isVisible])

  const {
    hasVerseNumbers,
    hasInlineVerses,
    hasQuotes,
    hasAppName,
  } = useShareOptions()

  useEffect(() => {
    const title = verseToReference(selectedVerses)
    setSelectedVersesTitle(title)
  }, [selectedVerses, version])

  const shareVerse = async () => {
    const { all: message } = await getVersesContent({
      verses: selectedVerses,
      version,
      hasVerseNumbers,
      hasInlineVerses,
      hasQuotes,
      hasAppName,
    })
    const result = await Share.share({ message })
    // Clear selectedverses only if succeed
    if (result.action === Share.sharedAction) {
      close()
    }
  }

  const copyToClipboard = async () => {
    const { all: message } = await getVersesContent({
      verses: selectedVerses,
      version,
      hasVerseNumbers,
      hasInlineVerses,
      hasQuotes,
      hasAppName,
    })
    Clipboard.setString(message)
    SnackBar.show(t('Copié dans le presse-papiers.'))
  }

  const showStrongDetail = () => {
    onChangeResourceType('strong')
  }

  const openCommentariesScreen = () => {
    onChangeResourceType('commentary')
  }

  const showDictionaryDetail = () => {
    onChangeResourceType('dictionary')
  }

  const compareVerses = () => {
    navigation.navigate('BibleCompareVerses', {
      selectedVerses,
    })
  }

  const onOpenReferences = () => {
    onChangeResourceType('reference')
  }

  const onOpenNave = () => {
    onChangeResourceType('nave')
  }

  const sendVerseData = async () => {
    const { title, content } = await getVersesContent({
      verses: selectedVerses,
      version,
    })
    navigation.navigate(openedFromTab ? 'AppSwitcher' : 'EditStudy', {
      ...cleanParams(),
      type: isSelectionMode,
      title,
      content,
      version,
      verses: Object.keys(selectedVerses),
    })
    close()
  }

  const moreThanOneVerseSelected = Object.keys(selectedVerses).length > 1

  return (
    <Modalize
      ref={ref}
      onClosed={clearSelectedVerses}
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
              <Box width={wp(20, 400)}>
                <TouchableSvgIcon
                  icon={LexiqueIcon}
                  color="primary"
                  onPress={showStrongDetail}
                  label={t('Lexique')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
              <Box width={wp(20, 400)}>
                <TouchableSvgIcon
                  icon={DictionnaireIcon}
                  color="secondary"
                  onPress={showDictionaryDetail}
                  label={t('Dictionnaire')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
              <Box width={wp(20, 400)}>
                <TouchableSvgIcon
                  icon={NaveIcon}
                  color="quint"
                  onPress={onOpenNave}
                  label={t('Thèmes')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
              <Box width={wp(20, 400)}>
                <TouchableSvgIcon
                  icon={RefIcon}
                  color="quart"
                  onPress={onOpenReferences}
                  label={t('Références')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
              <Box width={wp(20, 400)}>
                <TouchableSvgIcon
                  icon={CommentIcon}
                  color="#26A69A"
                  onPress={openCommentariesScreen}
                  label={t('Comment.')}
                  disabled={moreThanOneVerseSelected}
                />
              </Box>
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
              <TouchableChip name="tag" onPress={addTag} label={t('Tag')} />
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

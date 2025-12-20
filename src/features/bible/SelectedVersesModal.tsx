import styled from '@emotion/native'
import Clipboard from '@react-native-clipboard/clipboard'
import React, { useEffect, useState } from 'react'
import { ScrollView, Share } from 'react-native'

import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { useNavigation } from '@react-navigation/native'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import CommentIcon from '~common/CommentIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import SnackBar from '~common/SnackBar'
import type { BibleResource, StudyNavigateBibleType, VerseIds } from '~common/types'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useShareOptions } from '~features/settings/BibleShareOptionsScreen'
import { openedFromTabAtom } from '~features/studies/atom'
import { onAnimateModalClose, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { useBottomSheet } from '~helpers/useBottomSheet'
import getVersesContent from '~helpers/getVersesContent'
import { cleanParams, wp } from '~helpers/utils'
import verseToReference from '../../helpers/verseToReference'
import type { VersionCode } from '../../state/tabs'
import ColorCirclesBar from './ColorCirclesBar'
import TouchableChip from './TouchableChip'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'

const HalfContainer = styled.View<{ border?: boolean }>(({ border, theme }) => ({
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  alignItems: 'stretch',
  height: 60,
}))

type Props = {
  isVisible: boolean
  isSelectionMode: StudyNavigateBibleType | undefined
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
  onAddToStudy: () => void
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
  onAddToStudy,
}: Props) => {
  const navigation = useNavigation()
  const [selectedVersesTitle, setSelectedVersesTitle] = useState('')
  const { ref, open, close } = useBottomSheet()
  const { t } = useTranslation()
  const openedFromTab = useAtomValue(openedFromTabAtom)

  useEffect(() => {
    if (isVisible) {
      open()
    }
    if (!isVisible) {
      close()
    }
  }, [isVisible])

  const { hasVerseNumbers, hasInlineVerses, hasQuotes, hasAppName } = useShareOptions()

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
    // @ts-ignore
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
    // @ts-ignore
    navigation.navigate({
      name: openedFromTab ? 'AppSwitcher' : 'EditStudy',
      params: {
        ...cleanParams(),
        type: isSelectionMode,
        title,
        content,
        version,
        verses: Object.keys(selectedVerses),
      },
      merge: true,
    })
    close()
  }

  const moreThanOneVerseSelected = Object.keys(selectedVerses).length > 1
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const onClose = () => {
    clearSelectedVerses()
  }

  const { bottomBarHeight } = useBottomBarHeightInTab()

  return (
    <BottomSheet
      ref={ref}
      onAnimate={onAnimateModalClose(onClose)}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      activeOffsetY={[-20, 20]}
      key={key}
      {...bottomSheetStyles}
      style={{
        ...(bottomSheetStyles.style as object),
      }}
    >
      <BottomSheetView
        style={{
          flex: 0,
          // minHeight: 100,
          paddingBottom: bottomBarHeight,
        }}
      >
        {isSelectionMode?.includes('verse') ? (
          <HStack gap={10} width="100%" alignItems="center" justifyContent="center" py={10}>
            <Text bold fontSize={18} textAlign="center">
              {selectedVersesTitle.toUpperCase()}
            </Text>
            <TouchableIcon name="arrow-right" size={20} onPress={sendVerseData} noFlex />
          </HStack>
        ) : isSelectionMode?.includes('strong') ? (
          <></>
        ) : (
          <>
            <HalfContainer border>
              <ColorCirclesBar
                isSelectedVerseHighlighted={isSelectedVerseHighlighted}
                addHighlight={addHighlight}
                removeHighlight={removeHighlight}
                onClose={close}
              />
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
                  minWidth: '100%',
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
                <TouchableChip name="layers" onPress={compareVerses} label={t('Comparer')} />
                <TouchableChip name="tag" onPress={addTag} label={t('Tag')} />
                <TouchableChip name="file-plus" onPress={onCreateNoteClick} label={t('Note')} />
                <TouchableChip
                  name="feather"
                  onPress={onAddToStudy}
                  label={t('study.addToStudy')}
                />
                <TouchableChip name="copy" onPress={copyToClipboard} label={t('Copier')} />
                <TouchableChip name="share-2" onPress={shareVerse} label={t('Partager')} />
                <TouchableChip onPress={selectAllVerses} label={t('Tout sélectionner')} />
              </ScrollView>
            </HalfContainer>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  )
}

export default VersesModal

import styled from '@emotion/native'
import Clipboard from '@react-native-clipboard/clipboard'
import React, { useCallback } from 'react'
import { Share } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'

import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import CommentIcon from '~common/CommentIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import { toast } from 'sonner-native'
import type { BibleResource, StudyNavigateBibleType, VerseIds } from '~common/types'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useShareOptions } from '~features/settings/BibleShareOptionsScreen'
import { openedFromTabAtom } from '~features/studies/atom'
import { onAnimateModalClose, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import getVersesContent from '~helpers/getVersesContent'
import { cleanParams, wp } from '~helpers/utils'
import verseToReference from '../../helpers/verseToReference'
import type { VersionCode } from '../../state/tabs'
import ColorCirclesBar from './ColorCirclesBar'
import TouchableChip from './TouchableChip'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'
import { isFullScreenBibleAtom } from 'src/state/app'
import { BOTTOM_INSET } from '~helpers/constants'

const HalfContainer = styled.View<{ border?: boolean }>(({ border, theme }) => ({
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  alignItems: 'stretch',
  height: 60,
}))

type Props = {
  ref?: React.RefObject<BottomSheet | null>
  isSelectionMode: StudyNavigateBibleType | undefined
  selectedVerseHighlightColor: string | null
  onChangeResourceType: (type: BibleResource) => void
  onCreateNoteClick: () => void
  onCreateLinkClick: () => void
  addHighlight: (color: string) => void
  addTag: () => void
  removeHighlight: () => void
  clearSelectedVerses: () => void
  selectedVerses: VerseIds
  selectAllVerses: () => void
  version: VersionCode
  onAddToStudy: () => void
  onAddBookmark: () => void
  onPinVerses: () => void
  onEnterAnnotationMode?: () => void
}

const VersesModal = ({
  ref,
  isSelectionMode,
  selectedVerseHighlightColor,
  onChangeResourceType,
  onCreateNoteClick,
  onCreateLinkClick,
  addHighlight,
  addTag,
  removeHighlight,
  clearSelectedVerses,
  selectedVerses,
  selectAllVerses,
  version,
  onAddToStudy,
  onAddBookmark,
  onPinVerses,
  onEnterAnnotationMode,
}: Props) => {
  const router = useRouter()
  const { t } = useTranslation()
  const openedFromTab = useAtomValue(openedFromTabAtom)
  const selectedVersesTitle = verseToReference(selectedVerses)

  const close = useCallback(() => {
    ref?.current?.close()
  }, [ref])

  const { hasVerseNumbers, hasInlineVerses, hasQuotes, hasAppName } = useShareOptions()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)

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
    toast(t('Copié dans le presse-papiers.'))
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
    router.push({
      pathname: '/bible-compare-verses',
      params: { selectedVerses: JSON.stringify(selectedVerses) },
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
    const pathname = openedFromTab ? '/' : '/edit-study'
    router.dismissTo({
      pathname,
      params: {
        ...cleanParams(),
        type: isSelectionMode,
        title,
        content,
        version,
        verses: JSON.stringify(Object.keys(selectedVerses)),
      },
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
          paddingBottom: isFullScreenBible ? BOTTOM_INSET : bottomBarHeight,
        }}
      >
        {typeof isSelectionMode === 'string' && isSelectionMode.includes('verse') ? (
          <HStack gap={10} width="100%" alignItems="center" justifyContent="center" py={10}>
            <Text bold fontSize={18} textAlign="center">
              {selectedVersesTitle.toUpperCase()}
            </Text>
            <TouchableIcon name="arrow-right" size={20} onPress={sendVerseData} noFlex />
          </HStack>
        ) : typeof isSelectionMode === 'string' && isSelectionMode.includes('strong') ? (
          <></>
        ) : (
          <>
            <HalfContainer border style={{ alignItems: 'center' }}>
              <ColorCirclesBar
                selectedVerseHighlightColor={selectedVerseHighlightColor}
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
                  name="bookmark"
                  onPress={onAddBookmark}
                  label={t('Marque-page')}
                  disabled={moreThanOneVerseSelected}
                />
                <TouchableChip name="link" onPress={onCreateLinkClick} label={t('Lien')} />
                <TouchableChip
                  name="feather"
                  onPress={onAddToStudy}
                  label={t('study.addToStudy')}
                />
                <TouchableChip name="map-pin" onPress={onPinVerses} label={t('tab.pinVerses')} />
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

import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import { BibleResource, StudyNavigateBibleType, Verse } from '~common/types'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import { Slide, Slides } from '~common/ui/Slider'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import CommentariesCard from '~features/commentaries/CommentariesCard'
import DictionnaireVerseDetailCard from '~features/dictionnary/DictionnaireVerseDetailCard'
import NaveModalCard from '~features/nave/NaveModalCard'
import formatVerseContent from '~helpers/formatVerseContent'
import { useBottomSheet } from '~helpers/useBottomSheet'
import { BibleTab, useBibleTabActions } from '../../../state/tabs'
import BibleVerseDetailCard from '../BibleVerseDetailCard'
import { ReferenceCard } from '../ReferenceCard'
import ResourcesModalFooter from './ResourcesModalFooter'
import BottomSheet, {
  BottomSheetFooter,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet/'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { View } from 'react-native-animatable'

type Props = {
  resourceModalRef: React.RefObject<BottomSheet>
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource) => void
  bibleAtom: PrimitiveAtom<BibleTab>
  isSelectionMode?: StudyNavigateBibleType
}
const ResourcesModal = ({
  resourceModalRef,
  resourceType,
  onChangeResourceType,
  bibleAtom,
  isSelectionMode,
}: Props) => {
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const bible = useAtomValue(bibleAtom)
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const insets = useSafeAreaInsets()
  const {
    data: { selectedVerses },
  } = bible
  const selectedVerse = Object.keys(selectedVerses)[0]

  const { title } = formatVerseContent([selectedVerse])

  const getSubtitleByResourceType = () => {
    switch (resourceType) {
      case 'strong':
        return t('Lexique hébreu & grec')
      case 'commentary':
        return t('Commentaires')
      case 'dictionary':
        return t('Dictionnaire')
      case 'nave':
        return t('Par thèmes')
      case 'reference':
        return t('Références croisées')
      default:
        return ''
    }
  }

  const getOptionsByResourceType = () => {
    switch (resourceType) {
      case 'commentary': {
        return (
          <PopOverMenu
            width={24}
            height={54}
            popover={
              <>
                <MenuOption
                  onSelect={() => {
                    openInNewTab({
                      id: `commentary-${Date.now()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'commentary',
                      data: {
                        verse: selectedVerse,
                      },
                    })
                  }}
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="external-link" size={15} />
                    <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        )
      }
      default:
        return undefined
    }
  }

  return (
    <BottomSheet
      key={key}
      ref={resourceModalRef}
      index={-1}
      topInset={insets.top}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      snapPoints={['100%']}
      footerComponent={props => (
        <BottomSheetFooter {...props}>
          <ResourcesModalFooter
            resourceType={resourceType}
            onChangeResourceType={onChangeResourceType}
          />
        </BottomSheetFooter>
      )}
      {...bottomSheetStyles}
    >
      <ModalHeader
        title={title}
        subTitle={getSubtitleByResourceType()}
        rightComponent={getOptionsByResourceType()}
        onClose={() => resourceModalRef.current?.close()}
      />
      {resourceType && (
        <Resource
          resourceType={resourceType}
          bibleAtom={bibleAtom}
          isSelectionMode={isSelectionMode}
        />
      )}
    </BottomSheet>
  )
}

const resources = ['strong', 'dictionary', 'nave', 'reference', 'commentary']

const Resource = ({
  bibleAtom,
  resourceType,
  isSelectionMode,
}: {
  bibleAtom: PrimitiveAtom<BibleTab>
  resourceType: BibleResource | null
  isSelectionMode?: StudyNavigateBibleType
}) => {
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const {
    data: { selectedVersion, selectedVerses },
  } = bible
  const selectedVerse = Object.keys(selectedVerses)[0]
  const [Livre, Chapitre, Verset] = selectedVerse
    ? selectedVerse?.split('-')
    : []

  const verseObj = {
    Livre,
    Chapitre,
    Verset,
    Texte: '',
  } as Verse

  const updateVerse = (incr: number) => {
    actions.selectSelectedVerse(`${Livre}-${Chapitre}-${Number(Verset) + incr}`)
  }

  if (!selectedVerse) return null

  return (
    <Slides index={resources.findIndex(r => r === resourceType)}>
      <Slide key="strong">
        <View
          style={{
            flex: 1,
            paddingBottom: bottomBarHeight + 54,
          }}
        >
          <BibleVerseDetailCard
            verse={verseObj}
            updateVerse={updateVerse}
            isSelectionMode={isSelectionMode}
          />
        </View>
      </Slide>
      <Slide key="dictionary">
        <View
          style={{
            flex: 1,
            paddingBottom: bottomBarHeight + 54,
          }}
        >
          <DictionnaireVerseDetailCard
            verse={verseObj}
            updateVerse={updateVerse}
          />
        </View>
      </Slide>
      <Slide key="nave">
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: bottomBarHeight + 54,
          }}
        >
          <NaveModalCard selectedVerse={selectedVerse} />
        </BottomSheetScrollView>
      </Slide>
      <Slide key="reference">
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: bottomBarHeight + 54,
          }}
        >
          <ReferenceCard
            selectedVerse={selectedVerse}
            version={selectedVersion}
          />
        </BottomSheetScrollView>
      </Slide>
      <Slide key="commentary">
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: bottomBarHeight + 54,
          }}
        >
          <CommentariesCard
            verse={selectedVerse}
            onChangeVerse={actions.selectSelectedVerse}
          />
        </BottomSheetScrollView>
      </Slide>
    </Slides>
  )
}

export default memo(ResourcesModal)

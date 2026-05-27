import BottomSheet, {
  BottomSheetFooter,
  BottomSheetFooterProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet/'
import { MenuView, type MenuAction } from '@expo/ui/community/menu'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ModalHeader from '~common/ModalHeader'
import { BibleResource, StudyNavigateBibleType } from '~common/types'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { Slide, Slides } from '~common/ui/Slider'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import CommentariesCard from '~features/commentaries/CommentariesCard'
import DictionnaireVerseDetailCard from '~features/dictionnary/DictionnaireVerseDetailCard'
import NaveModalCard from '~features/nave/NaveModalCard'
import CompareCard from './CompareCard'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import formatVerseContent from '~helpers/formatVerseContent'
import generateUUID from '~helpers/generateUUID'
import { toast } from '~helpers/toast'
import { BibleTab, useBibleTabActions } from '../../../state/tabs'
import BibleVerseDetailCard from '../BibleVerseDetailCard'
import CompareVersionSelectorBottomSheet from '../CompareVersionSelectorBottomSheet'
import { ReferenceCard } from '../ReferenceCard'
import ResourcesModalFooter from './ResourcesModalFooter'
import { useResourceLanguage } from 'src/state/resourcesLanguage'

type ResourceVerse = {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

type Props = {
  resourceModalRef: React.RefObject<BottomSheet | null>
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource) => void
  bibleAtom: PrimitiveAtom<BibleTab>
  isSelectionMode?: StudyNavigateBibleType
}

// const useCloseOnRouteChange = () => {
//  const navigation = useNavigation()

//   useEffect(() => {
//     const beforeRemoveUnsubscribe = navigation.addListener(
//       'beforeRemove',
//       () => {
//         if (resourceModalRef.current) {
//           resourceModalRef.current.close()
//         }
//       }
//     )

//     const blurUnsubscribe = navigation.addListener('blur', () => {
//       if (resourceModalRef.current) {
//         resourceModalRef.current.close()
//       }
//     })

//     return () => {
//       beforeRemoveUnsubscribe()
//       blurUnsubscribe()
//     }
//   }, [navigation, resourceModalRef])
// }

const ResourcesModal = memo(
  ({ resourceModalRef, resourceType, onChangeResourceType, bibleAtom, isSelectionMode }: Props) => {
    const { t } = useTranslation()
    const compareVersionSelectorRef = React.useRef<BottomSheet>(null)
    const [isOpen, setIsOpen] = useState(false)
    const openInNewTab = useOpenInNewTab()
    const bible = useAtomValue(bibleAtom)
    const [strongLanguage, setStrongLanguage] = useResourceLanguage('STRONG')
    const [dictionaryLanguage, setDictionaryLanguage] = useResourceLanguage('DICTIONNAIRE')
    const [naveLanguage, setNaveLanguage] = useResourceLanguage('NAVE')
    const [commentariesLanguage, setCommentariesLanguage] = useResourceLanguage('COMMENTARIES')
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
        case 'compare':
          return t('Comparer les versions')
        default:
          return ''
      }
    }

    const toggleResourceLanguage = (
      currentLanguage: 'fr' | 'en',
      setLanguage: (language: 'fr' | 'en') => void
    ) => {
      const nextLanguage = currentLanguage === 'fr' ? 'en' : 'fr'
      setLanguage(nextLanguage)
      toast(t('menu.languageChanged', { language: nextLanguage === 'fr' ? 'Français' : 'English' }))
    }

    const getMenuActionsByResourceType = (): MenuAction[] => {
      const languageAction = (currentLanguage: 'fr' | 'en'): MenuAction => ({
        id: 'language',
        title: `${t('menu.language')}: ${currentLanguage === 'fr' ? 'Français' : 'English'}`,
        image: 'globe',
      })

      switch (resourceType) {
        case 'strong':
          return [languageAction(strongLanguage)]
        case 'dictionary':
          return [languageAction(dictionaryLanguage)]
        case 'nave':
          return [languageAction(naveLanguage)]
        case 'commentary':
          return [
            languageAction(commentariesLanguage),
            {
              id: 'open-tab',
              title: t('tab.openInNewTab'),
              image: 'arrow.up.forward.square',
            },
          ]
        case 'compare':
          return [
            {
              id: 'choose-versions',
              title: t('common.chooseCompareVersions'),
              image: 'checkmark.square',
            },
            {
              id: 'open-tab',
              title: t('tab.openInNewTab'),
              image: 'arrow.up.forward.square',
            },
          ]
        default:
          return []
      }
    }

    const handleMenuAction = (actionId: string) => {
      switch (actionId) {
        case 'language':
          if (resourceType === 'strong') toggleResourceLanguage(strongLanguage, setStrongLanguage)
          if (resourceType === 'dictionary') {
            toggleResourceLanguage(dictionaryLanguage, setDictionaryLanguage)
          }
          if (resourceType === 'nave') toggleResourceLanguage(naveLanguage, setNaveLanguage)
          if (resourceType === 'commentary') {
            toggleResourceLanguage(commentariesLanguage, setCommentariesLanguage)
          }
          break
        case 'choose-versions':
          compareVersionSelectorRef.current?.expand()
          break
        case 'open-tab':
          if (resourceType === 'commentary') {
            openInNewTab({
              id: `commentary-${generateUUID()}`,
              title: t('tabs.new'),
              isRemovable: true,
              type: 'commentary',
              data: { verse: selectedVerse },
            })
          }
          if (resourceType === 'compare') {
            openInNewTab({
              id: `compare-${generateUUID()}`,
              title: t('tabs.new'),
              isRemovable: true,
              type: 'compare',
              data: { selectedVerses },
            })
          }
          break
      }
    }

    const closeModal = () => {
      resourceModalRef.current?.close()
    }

    useEffect(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!isOpen) return false

        closeModal()
        return true
      })

      return () => subscription.remove()
    }, [isOpen])

    const renderRightComponent = () => {
      const menuActions = getMenuActionsByResourceType()

      return (
        <Box row alignItems="center">
          {menuActions.length ? (
            <MenuView
              actions={menuActions}
              onPressAction={({ nativeEvent }) => handleMenuAction(nativeEvent.event)}
            >
              <Box row center height={54} width={44}>
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            </MenuView>
          ) : null}
        </Box>
      )
    }

    const footerComponent = useCallback(
      (props: BottomSheetFooterProps) => {
        return (
          <BottomSheetFooter {...props}>
            <ResourcesModalFooter
              resourceType={resourceType}
              onChangeResourceType={onChangeResourceType}
            />
          </BottomSheetFooter>
        )
      },
      [resourceType, onChangeResourceType]
    )

    return (
      <>
        <BottomSheet
          index={-1}
          key={key}
          ref={resourceModalRef}
          topInset={insets.top}
          enablePanDownToClose
          enableDynamicSizing={false}
          backdropComponent={renderBackdrop}
          activeOffsetY={[-20, 20]}
          snapPoints={['100%']}
          footerComponent={footerComponent}
          onChange={index => setIsOpen(index >= 0)}
          onClose={() => setIsOpen(false)}
          {...bottomSheetStyles}
        >
          <ModalHeader
            hasBackButton
            onBackPress={closeModal}
            title={title}
            subTitle={getSubtitleByResourceType()}
            rightComponent={renderRightComponent()}
          />
          {resourceType && (
            <View style={{ flex: 1 }}>
              <Resource
                resourceType={resourceType}
                bibleAtom={bibleAtom}
                isSelectionMode={isSelectionMode}
              />
            </View>
          )}
        </BottomSheet>
        <CompareVersionSelectorBottomSheet bottomSheetRef={compareVersionSelectorRef} />
      </>
    )
  }
)

const resources = ['strong', 'dictionary', 'nave', 'reference', 'commentary', 'compare']

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
  const [Livre, Chapitre, Verset] = selectedVerse ? selectedVerse?.split('-') : []

  const verseObj: ResourceVerse = {
    Livre: Number(Livre),
    Chapitre: Number(Chapitre),
    Verset: Number(Verset),
    Texte: '',
  }

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
          <DictionnaireVerseDetailCard verse={verseObj} updateVerse={updateVerse} />
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
          <ReferenceCard selectedVerse={selectedVerse} version={selectedVersion} />
        </BottomSheetScrollView>
      </Slide>
      <Slide key="commentary">
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: bottomBarHeight + 54,
          }}
        >
          <CommentariesCard verse={selectedVerse} onChangeVerse={actions.selectSelectedVerse} />
        </BottomSheetScrollView>
      </Slide>
      <Slide key="compare">
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: bottomBarHeight + 54,
          }}
        >
          <CompareCard
            selectedVerses={selectedVerses}
            onChangeVerse={actions.selectSelectedVerse}
          />
        </BottomSheetScrollView>
      </Slide>
    </Slides>
  )
}

export default memo(ResourcesModal)

import { useTheme } from '@emotion/react'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, View } from 'react-native'
import { useResourceLanguage } from 'src/state/resourcesLanguage'
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetScrollView,
  type SheetFooterProps,
  type SheetRef,
} from '~common/sheet'
import { BibleResource, StudyNavigateBibleType } from '~common/types'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { Slide, Slides } from '~common/ui/Slider'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import CommentariesCard from '~features/commentaries/CommentariesCard'
import DictionnaireVerseDetailCard from '~features/dictionnary/DictionnaireVerseDetailCard'
import NaveModalCard from '~features/nave/NaveModalCard'
import formatVerseContent from '~helpers/formatVerseContent'
import generateUUID from '~helpers/generateUUID'
import { toast } from '~helpers/toast'
import { BibleTab, useBibleTabActions } from '../../../state/tabs'
import BibleVerseDetailCard from '../BibleVerseDetailCard'
import CompareVersionSelectorSheet from '../CompareVersionSelectorSheet'
import { ReferenceCard } from '../ReferenceCard'
import CompareCard from './CompareCard'
import ResourcesModalFooter from './ResourcesModalFooter'

type ResourceVerse = {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

type Props = {
  resourceModalRef: React.RefObject<SheetRef | null>
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource) => void
  bibleAtom: PrimitiveAtom<BibleTab>
  isSelectionMode?: StudyNavigateBibleType
}

const ResourcesModal = memo(
  ({ resourceModalRef, resourceType, onChangeResourceType, bibleAtom, isSelectionMode }: Props) => {
    const { t } = useTranslation()
    const compareVersionSelectorRef = React.useRef<SheetRef>(null)
    const [isOpen, setIsOpen] = useState(false)
    const openInNewTab = useOpenInNewTab()
    const bible = useAtomValue(bibleAtom)
    const [strongLanguage, setStrongLanguage] = useResourceLanguage('STRONG')
    const [dictionaryLanguage, setDictionaryLanguage] = useResourceLanguage('DICTIONNAIRE')
    const [naveLanguage, setNaveLanguage] = useResourceLanguage('NAVE')
    const [commentariesLanguage, setCommentariesLanguage] = useResourceLanguage('COMMENTARIES')
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
          compareVersionSelectorRef.current?.present()
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

    const footerRenderer = useCallback(
      (props: SheetFooterProps) => {
        return (
          <SheetFooter px={0} py={0} {...props}>
            <ResourcesModalFooter
              resourceType={resourceType}
              onChangeResourceType={onChangeResourceType}
            />
          </SheetFooter>
        )
      },
      [resourceType, onChangeResourceType]
    )

    const theme = useTheme()

    return (
      <>
        <Sheet
          ref={resourceModalRef}
          snapPoints={[1]}
          footer={footerRenderer}
          onOpenChange={setIsOpen}
          onClose={() => setIsOpen(false)}
          backgroundColor={theme.colors.reverse}
          header={
            <SheetHeader
              hasBackButton
              onBackPress={closeModal}
              title={title}
              subTitle={getSubtitleByResourceType()}
              rightComponent={renderRightComponent()}
            />
          }
        >
          {resourceType && (
            <View style={{ flex: 1 }}>
              <Resource
                resourceType={resourceType}
                bibleAtom={bibleAtom}
                isSelectionMode={isSelectionMode}
              />
            </View>
          )}
        </Sheet>
        <CompareVersionSelectorSheet sheetRef={compareVersionSelectorRef} />
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
          }}
        >
          <DictionnaireVerseDetailCard verse={verseObj} updateVerse={updateVerse} />
        </View>
      </Slide>
      <Slide key="nave">
        <SheetScrollView contentContainerStyle={{}}>
          <NaveModalCard selectedVerse={selectedVerse} />
        </SheetScrollView>
      </Slide>
      <Slide key="reference">
        <SheetScrollView contentContainerStyle={{}}>
          <ReferenceCard selectedVerse={selectedVerse} version={selectedVersion} />
        </SheetScrollView>
      </Slide>
      <Slide key="commentary">
        <CommentariesCard verse={selectedVerse} onChangeVerse={actions.selectSelectedVerse} />
      </Slide>
      <Slide key="compare">
        <SheetScrollView contentContainerStyle={{}}>
          <CompareCard
            selectedVerses={selectedVerses}
            onChangeVerse={actions.selectSelectedVerse}
          />
        </SheetScrollView>
      </Slide>
    </Slides>
  )
}

export default memo(ResourcesModal)

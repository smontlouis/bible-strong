import { twMerge } from '~common/ui/classNames'
import { useTheme } from '~themes/ThemeProvider'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useResourceLanguage } from 'src/state/resourcesLanguage'
import { subscribeToHardwareBackPress } from '~helpers/hardwareBackPress'
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetScrollView,
  type SheetFooterProps,
  type SheetRef,
} from '~common/sheet'
import { BibleResource, StudyNavigateBibleType, VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { Slide, Slides } from '~common/ui/Slider'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import CommentariesCard from '~features/commentaries/CommentariesCard'
import CommentarySelectorSheet from '~features/commentaries/CommentarySelectorSheet'
import DictionnaireVerseDetailCard from '~features/dictionnary/DictionnaireVerseDetailCard'
import NaveModalCard from '~features/nave/NaveModalCard'
import formatVerseContent from '~helpers/formatVerseContent'
import generateUUID from '~helpers/generateUUID'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import { toast } from '~helpers/toast'
import type { LexiconBibleProvenance } from '~features/resources/lexiconBibleResourceAccess'
import { BibleTab, useBibleTabActions, VersionCode } from '../../../state/tabs'
import BibleVerseDetailCard from '../BibleVerseDetailCard'
import CompareVersionSelectorSheet from '../CompareVersionSelectorSheet'
import CompareStrongModeButton from '../CompareStrongModeButton'
import { ReferenceCard } from '../ReferenceCard'
import CompareCard from './CompareCard'
import ResourcesModalFooter from './ResourcesModalFooter'
import { StrongBibleSourceButton, StrongBibleSourceSheet } from './StrongBibleSourceSelector'
import { getLanguage } from '~i18n'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import Header from '~common/Header'
type ResourceVerse = {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

export type ResourceModalProps = {
  inline?: boolean
  resourceModalRef: React.RefObject<SheetRef | null>
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource) => void
  bibleAtom: PrimitiveAtom<BibleTab>
  isSelectionMode?: StudyNavigateBibleType
  selectedVersion?: VersionCode
  selectedVerses?: VerseIds
  onChangeVerse?: (verseKey: string) => void
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

const ResourcesModal = ({
  resourceModalRef,
  resourceType,
  onChangeResourceType,
  bibleAtom,
  isSelectionMode,
  selectedVersion,
  selectedVerses: selectedVersesProp,
  onChangeVerse,
  inline = false,
}: ResourceModalProps) => {
  const { t } = useTranslation()
  const compareVersionSelectorRef = React.useRef<SheetRef>(null)
  const commentarySelectorRef = React.useRef<SheetRef>(null)
  const strongBibleSourceSheetRef = React.useRef<SheetRef>(null)
  const [isOpen, setIsOpen] = useState(inline)
  const [compareStrongMode, setCompareStrongMode] = useState(false)
  const openInNewTab = useOpenInNewTab()
  const bible = useAtomValue(bibleAtom)
  const [strongLanguage, setStrongLanguage] = useResourceLanguage('STRONG')
  const [dictionaryLanguage, setDictionaryLanguage] = useResourceLanguage('DICTIONNAIRE')
  const [naveLanguage, setNaveLanguage] = useResourceLanguage('NAVE')
  const {
    data: {
      selectedVersion: bibleSelectedVersion,
      selectedVerses: bibleSelectedVerses,
      strongBibleSourceVersionId,
    },
  } = bible
  const [resolvedStrongProvenance, setResolvedStrongProvenance] =
    useState<LexiconBibleProvenance | null>(null)
  const selectedVerses = selectedVersesProp ?? bibleSelectedVerses
  const effectiveSelectedVersion = selectedVersion ?? bibleSelectedVersion
  const selectedVerse = Object.keys(selectedVerses)[0]

  const { title } = formatVerseContent([selectedVerse])

  const getSubtitleByResourceType = () => {
    switch (resourceType) {
      case 'strong':
        return t('Lexique')
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
          {
            id: 'choose-commentaries',
            title: t('commentaries.selector.title'),
            image: 'checkmark.square',
          },
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
        break
      case 'choose-versions':
        compareVersionSelectorRef.current?.present()
        break
      case 'choose-commentaries':
        commentarySelectorRef.current?.present()
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
            data: { selectedVerses, strongMode: compareStrongMode },
          })
        }
        break
    }
  }

  const closeModal = () => {
    resourceModalRef.current?.close()
  }

  useEffect(() => {
    return subscribeToHardwareBackPress(() => {
      if (!isOpen) return false

      resourceModalRef.current?.close()
      return true
    })
  }, [isOpen, resourceModalRef])

  const renderRightComponent = () => {
    const menuActions = getMenuActionsByResourceType()

    return (
      <Box className="overflow-hidden border-continuous flex-row items-center">
        {resourceType === 'compare' ? (
          <CompareStrongModeButton
            enabled={compareStrongMode}
            onPress={() => setCompareStrongMode(value => !value)}
          />
        ) : null}
        {resourceType === 'strong' ? (
          <StrongBibleSourceButton
            bibleAtom={bibleAtom}
            resolvedProvenance={resolvedStrongProvenance}
            onPress={() => strongBibleSourceSheetRef.current?.present()}
          />
        ) : null}
        {menuActions.length ? (
          <MenuView
            actions={menuActions}
            onPressAction={({ nativeEvent }) => handleMenuAction(nativeEvent.event)}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[44px]">
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </MenuView>
        ) : null}
      </Box>
    )
  }

  const footerRenderer = (props: SheetFooterProps) => {
    return (
      <SheetFooter {...props} className={twMerge('px-[0px] py-[0px]', props.className)}>
        <ResourcesModalFooter
          resourceType={resourceType}
          onChangeResourceType={onChangeResourceType}
        />
      </SheetFooter>
    )
  }

  const theme = useTheme()
  const Container = inline ? ResourceSidebarContent : Sheet

  return (
    <>
      <Container
        ref={resourceModalRef}
        snapPoints={[1]}
        footer={footerRenderer}
        onOpenChange={setIsOpen}
        onClose={() => setIsOpen(false)}
        backgroundColor={theme.colors.reverse}
        header={
          <SheetHeader
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
              selectedVersion={effectiveSelectedVersion}
              preferredStrongVersionId={strongBibleSourceVersionId}
              preferredInterlinearLocale={bible.data.interlinearLocale ?? getLanguage()}
              onStrongBibleProvenanceChange={setResolvedStrongProvenance}
              onOpenStrongBibleSourceSheet={() => strongBibleSourceSheetRef.current?.present()}
              selectedVerses={selectedVerses}
              compareStrongMode={compareStrongMode}
              onChangeVerse={onChangeVerse}
              onChooseCompareVersions={() => compareVersionSelectorRef.current?.present()}
              commentarySelectorRef={commentarySelectorRef}
            />
          </View>
        )}
      </Container>
      <CompareVersionSelectorSheet sheetRef={compareVersionSelectorRef} />
      <CommentarySelectorSheet sheetRef={commentarySelectorRef} />
      <StrongBibleSourceSheet
        sheetRef={strongBibleSourceSheetRef}
        bibleAtom={bibleAtom}
        isResourceModalOpen={isOpen}
        resolvedProvenance={resolvedStrongProvenance}
      />
    </>
  )
}

const resources = ['strong', 'dictionary', 'nave', 'reference', 'commentary', 'compare']

const Resource = ({
  bibleAtom,
  resourceType,
  isSelectionMode,
  selectedVersion,
  preferredStrongVersionId,
  preferredInterlinearLocale,
  onStrongBibleProvenanceChange,
  onOpenStrongBibleSourceSheet,
  selectedVerses,
  compareStrongMode,
  onChangeVerse,
  onChooseCompareVersions,
  commentarySelectorRef,
}: {
  bibleAtom: PrimitiveAtom<BibleTab>
  resourceType: BibleResource | null
  isSelectionMode?: StudyNavigateBibleType
  selectedVersion: VersionCode
  preferredStrongVersionId?: StrongBibleVersionId
  preferredInterlinearLocale: ResourceLanguage
  onStrongBibleProvenanceChange?: (provenance: LexiconBibleProvenance | null) => void
  onOpenStrongBibleSourceSheet: () => void
  selectedVerses: VerseIds
  compareStrongMode: boolean
  onChangeVerse?: (verseKey: string) => void
  onChooseCompareVersions: () => void
  commentarySelectorRef: React.RefObject<SheetRef | null>
}) => {
  const actions = useBibleTabActions(bibleAtom)
  const selectedVerse = Object.keys(selectedVerses)[0]
  const [Livre, Chapitre, Verset] = selectedVerse ? selectedVerse?.split('-') : []

  const verseObj: ResourceVerse = {
    Livre: Number(Livre),
    Chapitre: Number(Chapitre),
    Verset: Number(Verset),
    Texte: '',
  }

  const updateVerse = (incr: number) => {
    const nextVerse = `${Livre}-${Chapitre}-${Number(Verset) + incr}`
    if (onChangeVerse) {
      onChangeVerse(nextVerse)
      return
    }

    actions.selectSelectedVerse(nextVerse)
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
            selectedVersion={selectedVersion}
            preferredStrongVersionId={preferredStrongVersionId}
            preferredInterlinearLocale={preferredInterlinearLocale}
            onStrongBibleProvenanceChange={onStrongBibleProvenanceChange}
            onOpenStrongBibleSourceSheet={onOpenStrongBibleSourceSheet}
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
          <DictionnaireVerseDetailCard
            verse={verseObj}
            selectedVersion={selectedVersion}
            updateVerse={updateVerse}
          />
        </View>
      </Slide>
      <Slide key="nave">
        <View style={{ flex: 1 }}>
          <NaveModalCard
            selectedVerse={selectedVerse}
            selectedVersion={selectedVersion}
            updateVerse={updateVerse}
          />
        </View>
      </Slide>
      <Slide key="reference">
        <SheetScrollView contentContainerStyle={{}}>
          <ReferenceCard selectedVerse={selectedVerse} version={selectedVersion} />
        </SheetScrollView>
      </Slide>
      <Slide key="commentary">
        <CommentariesCard
          verse={selectedVerse}
          preferredVersion={selectedVersion}
          onChangeVerse={onChangeVerse ?? actions.selectSelectedVerse}
          commentarySelectorRef={commentarySelectorRef}
        />
      </Slide>
      <Slide key="compare">
        <SheetScrollView contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}>
          <CompareCard
            selectedVerses={selectedVerses}
            strongMode={compareStrongMode}
            onChangeVerse={onChangeVerse ?? actions.selectSelectedVerse}
            onChooseVersions={onChooseCompareVersions}
          />
        </SheetScrollView>
      </Slide>
    </Slides>
  )
}

export default ResourcesModal

const ResourceSidebarContent = ({
  children,
  header,
  footer: Footer,
}: import('~common/sheet').SheetProps & { ref?: React.Ref<SheetRef> }) => {
  const heading = React.isValidElement<{
    title?: string
    subTitle?: string
    rightComponent?: React.ReactNode
  }>(header)
    ? header.props
    : undefined
  return (
    <Box className="flex-1 min-h-0" testID="passage-resources-sidebar">
      <Header
        hasBackButton
        title={heading?.title}
        subTitle={heading?.subTitle}
        rightComponent={heading?.rightComponent}
      />
      <Box className="flex-1 min-h-0 overflow-hidden">{children}</Box>
      {Footer && <Footer />}
    </Box>
  )
}

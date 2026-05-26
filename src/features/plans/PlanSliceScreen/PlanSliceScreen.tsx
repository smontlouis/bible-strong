import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import MenuOption from '~common/ui/MenuOption'

import { useTranslation } from 'react-i18next'
import { Share } from 'react-native'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import { toast } from '~helpers/toast'
import { ComputedReadingSlice, EntitySlice, Plan } from '~common/types'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { chapterToReference } from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'
import { markAsRead } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import { makeIsReadSelector } from '~redux/selectors/plan'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { useDefaultBibleVersion } from '../../../state/useDefaultBibleVersion'
import { BibleTab } from '../../../state/tabs'
import ParamsModal from './ParamsModal'
import PauseText from './PauseText'
import ReadButton from './ReadButton'
import ReferenceParagraph from './ReferenceParagraph'
import Slice from './Slice'
import { chapterSliceToText, verseSliceToText, videoSliceToText } from './share'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'

const extractTitle = (slice: EntitySlice) => {
  switch (slice.type) {
    case 'Verse':
      return verseToReference(slice.verses, { isPlan: true })
    case 'Chapter':
      return chapterToReference(slice.chapters)
    default:
      return ''
  }
}

// Constants for versionData optimization
const DEFAULT_BOOK = { Numero: 1, Nom: 'Genèse', Chapitres: 50 }
const EMPTY_ARRAY: never[] = []
const EMPTY_OBJECT = {}

interface PlanSliceMenuContentProps {
  isRead: boolean
  onMarkAsRead: () => void
  onOpenVersionSelector: () => void
  onOpenParams: () => void
  onOpenInNewTab: () => void
  onShare: () => void
  version: string
}

const PlanSliceMenuContent = ({
  isRead,
  onMarkAsRead,
  onOpenVersionSelector,
  onOpenParams,
  onOpenInNewTab,
  onShare,
  version,
}: PlanSliceMenuContentProps) => {
  const { t } = useTranslation()

  return (
    <>
      <MenuOption onSelect={onMarkAsRead}>
        <Box row alignItems="center">
          <MaterialIcon
            name="check"
            size={20}
            color="success"
            style={{ opacity: isRead ? 0.3 : 1 }}
          />
          <Text marginLeft={10}>{isRead ? t('Marquer comme non lu') : t('Marquer comme lu')}</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onOpenVersionSelector}>
        <Box row alignItems="center">
          <TextIcon style={{ fontSize: 12 }}>{version}</TextIcon>
          <Text marginLeft={10}>{t('Changer de version')}</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onOpenParams}>
        <Box row alignItems="center">
          <TextIcon>Aa</TextIcon>
          <Text marginLeft={10}>{t('Mise en forme')}</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onShare} closeBeforeSelect>
        <Box row alignItems="center">
          <FeatherIcon name="share-2" size={17} style={{ marginRight: 10 }} />
          <Text marginLeft={10}>{t('Partager')}</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onOpenInNewTab}>
        <Box row alignItems="center">
          <FeatherIcon name="external-link" size={17} style={{ marginRight: 10 }} />
          <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
        </Box>
      </MenuOption>
    </>
  )
}

interface Props {
  readingSlice?: ComputedReadingSlice & {
    planId: string
    planTitle?: string
    planLanguage?: Plan['lang']
  }
  planTitle?: string
  onBack?: () => void
  onRead?: () => void
}

const PlanSliceScreen = ({
  readingSlice: readingSliceFromProps,
  planTitle,
  onBack,
  onRead,
}: Props) => {
  const router = useRouter()
  const params = useLocalSearchParams<{ readingSlice?: string }>()
  const openInNewTab = useOpenInNewTab()

  // Parse complex object from URL string
  const readingSlice =
    readingSliceFromProps ||
    (params.readingSlice
      ? (JSON.parse(params.readingSlice) as ComputedReadingSlice & {
          planId: string
          planTitle?: string
          planLanguage?: Plan['lang']
        })
      : undefined)
  const {
    id,
    title,
    slices,
    planId,
    planTitle: routePlanTitle,
    planLanguage,
  } = (readingSlice || {}) as Partial<
    ComputedReadingSlice & { planId: string; planTitle?: string; planLanguage: Plan['lang'] }
  >

  const { t } = useTranslation()
  const dispatch = useDispatch()
  const paramsModalRef = React.useRef<BottomSheetModal>(null)

  const selectIsRead = makeIsReadSelector()
  const isRead = useSelector((state: RootState) => selectIsRead(state, planId ?? '', id ?? ''))
  const version = useDefaultBibleVersion()
  const { openVersionSelector } = useBookAndVersionSelector()

  // Actions that dispatch to Redux for changing default version
  const versionActions = {
    setSelectedVersion: (v: string) => dispatch(setDefaultBibleVersion(v)),
    setParallelVersion: () => {}, // Not used in plans
  }

  // Minimal data required for version selector
  const versionData: BibleTab['data'] = {
    selectedVersion: version,
    parallelVersions: EMPTY_ARRAY,
    selectedBook: DEFAULT_BOOK,
    selectedChapter: 1,
    selectedVerse: 1,
    focusVerses: undefined,
    temp: {
      selectedBook: DEFAULT_BOOK,
      selectedChapter: 1,
      selectedVerse: 1,
    },
    selectedVerses: EMPTY_OBJECT,
    selectionMode: 'grid',
    isSelectionMode: undefined,
    contextDisplayMode: 'focused',
  }

  const onMarkAsReadSelect = () => {
    dispatch(markAsRead({ readingSliceId: id!, planId: planId! }))
    if (onRead) {
      onRead()
      return
    }
    router.back()
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    router.back()
  }

  const openSliceInNewTab = () => {
    if (!planId || !id) return
    openInNewTab({
      id: `plan-${generateUUID()}`,
      title: planTitle || routePlanTitle || title || '',
      isRemovable: true,
      type: 'plan',
      data: { planId, readingSliceId: id },
    })
  }

  const mainSlice: EntitySlice | undefined = slices?.find(
    s => s.type === 'Chapter' || s.type === 'Verse'
  )
  const sliceTitle = mainSlice ? extractTitle(mainSlice) : ''

  const share = async () => {
    const textSlices = await Promise.all(
      (slices ?? []).map(async slice => {
        switch (slice.type) {
          case 'Chapter': {
            return await chapterSliceToText(slice, version)
          }
          case 'Verse': {
            return await verseSliceToText(slice, version)
          }
          case 'Video': {
            return await videoSliceToText(slice)
          }
          case 'Title': {
            return slice.title
          }
          case 'Text': {
            return `${slice.description}`
          }
          case 'Image':
          default: {
            return ''
          }
        }
      })
    )

    const message = `${sliceTitle || title}\n\n${textSlices.join('\n\n')}`
    try {
      Share.share({ message })
    } catch (e) {
      toast.error('Erreur lors du partage.')
      console.log('[Plans] Error sharing:', e)
    }
  }

  return (
    <Container>
      <Header
        title={sliceTitle}
        hasBackButton
        onCustomBackPress={handleBack}
        rightComponent={
          <PopOverMenu
            popover={
              <PlanSliceMenuContent
                isRead={isRead}
                onMarkAsRead={onMarkAsReadSelect}
                onOpenVersionSelector={() =>
                  openVersionSelector({ actions: versionActions, data: versionData })
                }
                onOpenParams={() => paramsModalRef.current?.present()}
                onOpenInNewTab={openSliceInNewTab}
                onShare={share}
                version={version}
              />
            }
          />
        }
      />
      <ScrollView>
        {isRead && (
          <Box
            opacity={0.6}
            backgroundColor="success"
            borderRadius={30}
            padding={20}
            marginHorizontal={20}
            center
            row
          >
            <FeatherIcon name="check" size={20} color="reverse" />
            <Paragraph marginLeft={5} color="reverse" scale={-2} fontFamily="text" bold>
              {t('Vous avez déjà terminé cette lecture.')}
            </Paragraph>
          </Box>
        )}
        <PauseText>
          {t(
            'Prenez une grande inspiration,\n alors que vous vous apprêtez à passer du\n temps avec Dieu'
          )}
        </PauseText>
        {title && (
          <Box paddingHorizontal={20} marginBottom={50}>
            <ReferenceParagraph scale={3} planLanguage={planLanguage}>
              {title}
            </ReferenceParagraph>
          </Box>
        )}
        {slices?.map(slice => (
          <Slice key={slice.id} {...slice} planLanguage={planLanguage} />
        ))}
        <Box height={80} center marginTop={30}>
          <ReadButton isRead={isRead} readingSliceId={id!} planId={planId!} onRead={onRead} />
        </Box>
      </ScrollView>
      <ParamsModal paramsModalRef={paramsModalRef} />
    </Container>
  )
}

export default PlanSliceScreen

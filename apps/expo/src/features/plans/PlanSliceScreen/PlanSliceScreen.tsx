import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import { useComputedPlan } from '../plan.hooks'
import {
  getLegacyReadingRouteLocation,
  findPlanTabReadingSlice,
  buildPlanTabReadingSlice,
} from '../planTabState'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import Button from '~common/ui/Button'
import type { MenuAction } from '~common/ui/MenuView'
import { goBackOrHome } from '~navigation/goBackOrHome'
import React from 'react'
import { READING_TEXT_MAX_WIDTH, PLAN_READING_HORIZONTAL_PADDING } from '~common/readingLayout'
import PlanSliceMenu from './PlanSliceMenu'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Share } from 'react-native'
import Header from '~common/Header'
import { toast } from '~helpers/toast'
import { ComputedReadingSlice, EntitySlice, Plan } from '~common/types'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import { chapterToReference } from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'
import { markAsRead } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import { makeIsReadSelector } from '~redux/selectors/plan'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { useDefaultBibleVersion } from '../../../state/useDefaultBibleVersion'
import { BibleTab } from '../../../state/tabs'
import ParamsModal from './ParamsModal'
import ReadButton from './ReadButton'
import ReferenceParagraph from './ReferenceParagraph'
import Slice from './Slice'
import { chapterSliceToText, verseSliceToText, videoSliceToText } from './share'
import { type SheetRef } from '~common/sheet'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { canUpdatePlanProgress } from '../planProgress'
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
  const params = useLocalSearchParams<{
    readingSlice?: string
    planId?: string
    readingSliceId?: string
  }>()
  const openInNewTab = useOpenInNewTab()

  const legacyLocation = getLegacyReadingRouteLocation(params.readingSlice)
  const contentPlanId =
    readingSliceFromProps?.planId || params.planId || legacyLocation?.planId || ''
  const contentReadingId =
    readingSliceFromProps?.id || params.readingSliceId || legacyLocation?.readingSliceId
  const { isError: contentError, retry: retryContent } = useReadingContent(contentPlanId)
  const currentPlan = useComputedPlan(contentPlanId)
  const currentReading = findPlanTabReadingSlice(currentPlan, contentReadingId)
  const readingSlice =
    readingSliceFromProps ||
    (currentPlan && currentReading
      ? buildPlanTabReadingSlice(currentPlan, currentReading)
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
  const paramsModalRef = React.useRef<SheetRef>(null)

  const selectIsRead = makeIsReadSelector()
  const canRecordProgress = useSelector((state: RootState) =>
    canUpdatePlanProgress(
      state.plan.myPlans.find(plan => plan.id === planId),
      state.plan.ongoingPlans.find(plan => plan.id === planId)
    )
  )
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
    if (!canRecordProgress) return
    dispatch(markAsRead({ readingSliceId: id!, planId: planId! }))
    if (onRead) {
      onRead()
      return
    }
    goBackOrHome(router)
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    goBackOrHome(router)
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

  const completionActions: MenuAction[] = canRecordProgress
    ? [
        {
          id: 'mark-read',
          title: isRead ? t('Marquer comme non lu') : t('Marquer comme lu'),
          image: 'checkmark',
        },
      ]
    : []

  if (!readingSlice) {
    return (
      <Container>
        <Header hasBackButton title={t('readingPlans.tab')} onCustomBackPress={handleBack} />
        {contentError || currentPlan ? (
          <>
            <Empty message={t('dailyReading.unavailableReading')} />
            {contentError && (
              <Box className="p-[20px]">
                <Button
                  onPress={() => {
                    void retryContent()
                  }}
                >
                  {t('dailyReading.retry')}
                </Button>
              </Box>
            )}
          </>
        ) : (
          <Loading />
        )}
      </Container>
    )
  }

  return (
    <Container>
      <Header
        title={sliceTitle || planTitle || routePlanTitle || title || ''}
        hasBackButton
        onCustomBackPress={handleBack}
        rightComponent={
          <PlanSliceMenu
            version={version}
            onVersionChange={versionActions.setSelectedVersion}
            actions={[
              ...completionActions,
              {
                id: 'version',
                title: `${t('Changer de version')} (${version})`,
                image: 'book',
              },
              { id: 'format', title: t('Mise en forme'), image: 'textformat' },
              { id: 'share', title: t('Partager'), image: 'square.and.arrow.up' },
              {
                id: 'open-tab',
                title: t('tab.openInNewTab'),
                image: 'arrow.up.forward.square',
              },
            ]}
            onPressAction={({ nativeEvent }) => {
              switch (nativeEvent.event) {
                case 'mark-read':
                  onMarkAsReadSelect()
                  break
                case 'version':
                  openVersionSelector({ actions: versionActions, data: versionData })
                  break
                case 'format':
                  paramsModalRef.current?.present()
                  break
                case 'share':
                  share()
                  break
                case 'open-tab':
                  openSliceInNewTab()
                  break
              }
            }}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[54px]">
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </PlanSliceMenu>
        }
      />
      <ScrollView
        key={`${planId}:${id}`}
        contentContainerStyle={{
          width: '100%',
          alignSelf: 'center',
          maxWidth: READING_TEXT_MAX_WIDTH + PLAN_READING_HORIZONTAL_PADDING * 2,
          paddingTop: 24,
          paddingBottom: 32,
        }}
      >
        {isRead && (
          <Box className="overflow-hidden border-continuous bg-light-grey rounded-[12px] p-[12px] mx-[20px] mb-[20px] items-center justify-center flex-row">
            <FeatherIcon name="check" size={18} color="primary" />
            <Paragraph className="ml-[5px] text-default font-bold" scale={-2} fontFamily="text">
              {t('readingPlans.dayCompleted')}
            </Paragraph>
          </Box>
        )}
        {title && (
          <Box className={`overflow-hidden border-continuous px-[20px] mb-[24px]`}>
            <ReferenceParagraph scale={3} planLanguage={planLanguage}>
              {title}
            </ReferenceParagraph>
          </Box>
        )}
        {slices?.map(slice => (
          <Slice key={slice.id} {...slice} planLanguage={planLanguage} />
        ))}
        <Box className="overflow-hidden border-continuous h-[80px] items-center justify-center mt-[30px]">
          {canRecordProgress && (
            <ReadButton isRead={isRead} readingSliceId={id!} planId={planId!} onRead={onRead} />
          )}
        </Box>
      </ScrollView>
      <ParamsModal paramsModalRef={paramsModalRef} />
    </Container>
  )
}

export default PlanSliceScreen

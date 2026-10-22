import { type SheetRef } from '~common/sheet'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { AppState } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { produce } from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { isFullScreenBibleAtom } from 'src/state/app'
import RenameModal from '~common/RenameModal'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import FabButton from '~common/ui/FabButton'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'
import { updateStudy, Study, type RelationEndpoint } from '~redux/modules/user'
import EditStudyHeader from './EditStudyHeader'
import StudiesDomWrapper from './StudiesDOM/StudiesDomWrapper'
import { openedFromTabAtom } from './atom'
import { StudyTab } from 'src/state/tabs'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { createStudyEndpoint } from '~features/studyRelations/endpoints'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { createStudyContentAutosave } from './studyContentAutosave'
type EditStudyScreenProps = {
  studyAtom?: PrimitiveAtom<StudyTab>
  // Props passed directly (when called from StudiesTabScreen)
  studyId?: string
  hasBackButton?: boolean
  openedFromTab?: boolean
  isFormSheet?: boolean
  onGoBack?: () => void
}

// Component to update tab title when study title changes
const TabTitleUpdater = ({
  studyAtom,
  title,
}: {
  studyAtom: PrimitiveAtom<StudyTab>
  title: string
}) => {
  const [, setStudyTab] = useAtom(studyAtom)

  useEffect(() => {
    if (title) {
      setStudyTab(
        produce(draft => {
          draft.title = title
        })
      )
    }
  }, [title, setStudyTab])

  return null
}

const EditStudyScreen = ({
  studyAtom,
  studyId: propStudyId,
  hasBackButton = true,
  openedFromTab = false,
  isFormSheet = false,
  onGoBack,
}: EditStudyScreenProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useLocalSearchParams<{
    studyId?: string
    type?: string
    title?: string
    content?: string
    version?: string
    verses?: string
  }>()

  // Use props if provided, otherwise parse from URL params
  const studyId = useMemo(() => propStudyId ?? params.studyId ?? '', [propStudyId, params.studyId])

  const dispatch = useDispatch()
  const store = useStore<RootState>()
  const [contentAutosave] = useState(() =>
    createStudyContentAutosave(change => {
      // A Study deleted meanwhile is not recreated by its last edit.
      if (!store.getState().user.bible.studies[change.id]) return
      // Dated when saved, so that it never goes before a rename saved meanwhile.
      dispatch(updateStudy({ ...change, modified_at: Date.now() }))
    })
  )
  const [isReadOnly, setIsReadOnly] = useState(true)
  const renameModalRef = useRef<SheetRef>(null)
  const openEntityRelations = useOpenEntityRelations()
  const setOpenedFromTab = useSetAtom(openedFromTabAtom)
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const currentStudy = useSelector((state: RootState) => state.user.bible.studies[studyId])
  const studyEndpoint: Extract<RelationEndpoint, { type: 'study' }> = createStudyEndpoint(
    studyId,
    currentStudy?.title || t('Études')
  )
  const relationCount = useRelationCount(studyEndpoint)
  const canGoBackInStack = useCanGoBackInStack()

  const onDeltaChangeCallback = (
    delta: Study['content'] | null,
    deltaChange: string | null,
    deltaOld: string | null,
    changeSource: string | null
  ) => {
    if (!currentStudy) return
    console.log('[Studies] delta', delta)
    contentAutosave.schedule({ id: currentStudy.id, ...(delta && { content: delta }) })
    // The editor sends its last change as the app leaves the foreground: it is saved at once.
    if (AppState.currentState !== 'active') contentAutosave.flush()
  }

  // Pending edits are saved when the screen goes away and when the app leaves the foreground,
  // where it may be ended without notice.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (status !== 'active') contentAutosave.flush()
    })
    return () => {
      subscription.remove()
      contentAutosave.flush()
    }
  }, [contentAutosave])
  useFocusEffect(useCallback(() => () => contentAutosave.flush(), [contentAutosave]))

  // Control weither bible webview send back to study tab or not
  const markOpenedFromTab = useEffectEvent(() => setOpenedFromTab(openedFromTab))
  useEffect(() => {
    markOpenedFromTab()
  }, [])

  useFocusEffect(
    useCallback(() => {
      setIsFullScreenBible(false)
    }, [setIsFullScreenBible])
  )

  useRecordHistory(currentStudy ? { type: 'study', studyId, title: currentStudy.title } : null)

  // Show message if study doesn't exist
  if (studyId === '' || !currentStudy) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center px-[20px]">
          <Text className="text-[18px] text-grey text-center mb-[20px]">
            {t("Cette étude n'existe plus")}
          </Text>
          <Button onPress={onGoBack ?? (() => router.navigate('/'))}>
            {t('Retour aux études')}
          </Button>
        </Box>
      </FormSheetScreen>
    )
  }

  return (
    // The editor keeps its own scroll and keyboard handling: the page stays above the home indicator
    // and the tab bar.
    <FormSheetScreen isFormSheet={isFormSheet} reserveBottom>
      {studyAtom && <TabTitleUpdater studyAtom={studyAtom} title={currentStudy.title} />}
      <EditStudyHeader
        isReadOnly={isReadOnly}
        hasBackButton={isFormSheet ? canGoBackInStack : hasBackButton}
        openRenameModal={() => renameModalRef.current?.present()}
        openRelationsModal={() => openEntityRelations(studyEndpoint)}
        setReadOnly={() => {
          // The read view reloads the editor from the store: it must hold the latest edits.
          contentAutosave.flush()
          setIsReadOnly(true)
        }}
        title={currentStudy.title}
        study={currentStudy}
        studyId={studyId}
      />

      <StudiesDomWrapper
        tags={currentStudy.tags}
        relationCount={relationCount}
        onOpenRelations={() => openEntityRelations(studyEndpoint)}
        isReadOnly={isReadOnly}
        onDeltaChangeCallback={onDeltaChangeCallback}
        contentToDisplay={currentStudy.content}
        fontFamily={fontFamily}
        params={{ ...params, studyId }}
        studyAtom={studyAtom}
        studyId={studyId}
        isFormSheet={isFormSheet}
      />
      <RenameModal
        sheetRef={renameModalRef}
        title={t("Renommer l'étude")}
        placeholder={t("Nom de l'étude")}
        initialValue={currentStudy.title}
        onSave={value => {
          dispatch(updateStudy({ id: currentStudy.id, title: value, modified_at: Date.now() }))
        }}
      />
      {isReadOnly && (
        <FabButton
          accessibilityLabel={t('accessibility.editStudy')}
          icon="edit-2"
          onPress={() => setIsReadOnly(false)}
        />
      )}
    </FormSheetScreen>
  )
}

export default EditStudyScreen

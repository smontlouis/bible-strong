import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { produce } from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { isFullScreenBibleAtom } from 'src/state/app'
import RenameModal from '~common/RenameModal'
import EntityChipList from '~common/EntityChipList'
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
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'

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
  const [isReadOnly, setIsReadOnly] = useState(true)
  const renameModalRef = useRef<BottomSheetModal>(null)
  const openEntityRelations = useOpenEntityRelations()
  const setOpenedFromTab = useSetAtom(openedFromTabAtom)
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const currentStudy = useSelector((state: RootState) => state.user.bible.studies[studyId])
  const studyEndpoint: Extract<RelationEndpoint, { type: 'study' }> = {
    type: 'study',
    studyId,
    label: currentStudy?.title || t('Études'),
  }
  const relationCount = useRelationCount(studyEndpoint)
  const canGoBackInStack = useCanGoBackInStack()
  const hasTagOrRelationChips =
    Boolean(currentStudy?.tags && Object.keys(currentStudy.tags).length > 0) || relationCount > 0

  const onDeltaChangeCallback = (
    delta: Study['content'] | null,
    deltaChange: string | null,
    deltaOld: string | null,
    changeSource: string | null
  ) => {
    if (!currentStudy) return
    console.log('[Studies] delta', delta)
    dispatch(
      updateStudy({
        id: currentStudy.id,
        ...(delta && { content: delta }),
        modified_at: Date.now(),
      })
    )
  }

  // Control weither bible webview send back to study tab or not
  useEffect(() => {
    setOpenedFromTab(openedFromTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFocusEffect(
    useCallback(() => {
      setIsFullScreenBible(false)
    }, [setIsFullScreenBible])
  )

  // Show message if study doesn't exist
  if (studyId === '' || !currentStudy) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Box flex center px={20}>
          <Text fontSize={18} color="grey" textAlign="center" mb={20}>
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
    <FormSheetScreen isFormSheet={isFormSheet}>
      {studyAtom && <TabTitleUpdater studyAtom={studyAtom} title={currentStudy.title} />}
      <EditStudyHeader
        isReadOnly={isReadOnly}
        hasBackButton={isFormSheet ? canGoBackInStack : hasBackButton}
        openRenameModal={() => renameModalRef.current?.present()}
        openRelationsModal={() => openEntityRelations(studyEndpoint)}
        setReadOnly={() => {
          setIsReadOnly(true)
        }}
        title={currentStudy.title}
        study={currentStudy}
      />
      {isReadOnly && hasTagOrRelationChips && (
        <Box px={20} py={12} borderBottomWidth={1} borderColor="border" bg="reverse">
          <EntityChipList
            tags={currentStudy.tags}
            relationCount={relationCount}
            onRelationPress={() => openEntityRelations(studyEndpoint)}
          />
        </Box>
      )}
      <StudiesDomWrapper
        isReadOnly={isReadOnly}
        onDeltaChangeCallback={onDeltaChangeCallback}
        contentToDisplay={currentStudy.content}
        fontFamily={fontFamily}
        params={{ studyId }}
        studyAtom={studyAtom}
        studyId={studyId}
        isFormSheet={isFormSheet}
      />
      <RenameModal
        bottomSheetRef={renameModalRef}
        title={t("Renommer l'étude")}
        placeholder={t("Nom de l'étude")}
        initialValue={currentStudy.title}
        onSave={value => {
          dispatch(updateStudy({ id: currentStudy.id, title: value, modified_at: Date.now() }))
        }}
      />
      {isReadOnly && <FabButton icon="edit-2" onPress={() => setIsReadOnly(false)} />}
    </FormSheetScreen>
  )
}

export default EditStudyScreen

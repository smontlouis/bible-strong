import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { useFocusEffect } from 'expo-router'
import { useLocalSearchParams, useRouter } from 'expo-router'
import produce from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { isFullScreenBibleValue } from 'src/state/app'
import RenameModal from '~common/RenameModal'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import { RootState } from '~redux/modules/reducer'
import { updateStudy } from '~redux/modules/user'
import EditStudyHeader from './EditStudyHeader'
import StudiesDomWrapper from './StudiesDOM/StudiesDomWrapper'
import { openedFromTabAtom } from './atom'
import { StudyTab } from 'src/state/tabs'
import { PrimitiveAtom } from 'jotai/vanilla'

type EditStudyScreenProps = {
  studyAtom?: PrimitiveAtom<StudyTab>
  // Props passed directly (when called from StudiesTabScreen)
  studyId?: string
  canEdit?: boolean
  hasBackButton?: boolean
  openedFromTab?: boolean
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
  canEdit: propCanEdit,
  hasBackButton: propHasBackButton,
  openedFromTab: propOpenedFromTab,
}: EditStudyScreenProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useLocalSearchParams<{
    studyId?: string
    canEdit?: string
    hasBackButton?: string
    openedFromTab?: string
    type?: string
    title?: string
    content?: string
    version?: string
    verses?: string
  }>()

  // Use props if provided, otherwise parse from URL params
  const studyId = useMemo(
    () => propStudyId ?? params.studyId ?? '',
    [propStudyId, params.studyId]
  )
  const canEdit = useMemo(
    () => propCanEdit ?? params.canEdit === 'true',
    [propCanEdit, params.canEdit]
  )
  const hasBackButton = useMemo(
    () => propHasBackButton ?? params.hasBackButton === 'true',
    [propHasBackButton, params.hasBackButton]
  )
  const openedFromTab = useMemo(
    () => propOpenedFromTab ?? params.openedFromTab === 'true',
    [propOpenedFromTab, params.openedFromTab]
  )

  const dispatch = useDispatch()
  const [isReadOnly, setIsReadOnly] = useState(!canEdit)
  const renameModalRef = useRef<BottomSheetModal>(null)
  const setOpenedFromTab = useSetAtom(openedFromTabAtom)

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const currentStudy = useSelector((state: RootState) => state.user.bible.studies[studyId])

  const onDeltaChangeCallback = (
    delta: string | null,
    deltaChange: string | null,
    deltaOld: string | null,
    changeSource: string | null
  ) => {
    console.log('[Studies] delta', delta)
    dispatch(
      updateStudy({
        id: currentStudy.id,
        content: delta,
        modified_at: Date.now(),
      })
    )
  }

  // Control weither bible webview send back to study tab or not
  useEffect(() => {
    setOpenedFromTab(openedFromTab || false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      isFullScreenBibleValue.set(false)
    }, [])
  )

  // prevent rendering if studyId is not set
  if (studyId === '' || !currentStudy) {
    return null
  }

  return (
    <Container>
      {studyAtom && <TabTitleUpdater studyAtom={studyAtom} title={currentStudy.title} />}
      <EditStudyHeader
        isReadOnly={isReadOnly}
        hasBackButton={hasBackButton}
        openRenameModal={() => renameModalRef.current?.present()}
        setReadOnly={() => {
          setIsReadOnly(true)
        }}
        title={currentStudy.title}
        study={currentStudy}
        navigation={router}
      />
      <StudiesDomWrapper
        isReadOnly={isReadOnly}
        onDeltaChangeCallback={onDeltaChangeCallback}
        contentToDisplay={currentStudy.content}
        fontFamily={fontFamily}
        params={params as any}
        studyAtom={studyAtom}
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
      {isReadOnly && (
        // @ts-ignore
        <FabButton icon="edit-2" onPress={() => setIsReadOnly(false)} />
      )}
    </Container>
  )
}

export default EditStudyScreen

import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import produce from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { isFullScreenBibleAtom } from 'src/state/app'
import RenameModal from '~common/RenameModal'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import Text from '~common/ui/Text'
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
  hasBackButton?: boolean
  openedFromTab?: boolean
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
  const setOpenedFromTab = useSetAtom(openedFromTabAtom)
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const currentStudy = useSelector((state: RootState) => state.user.bible.studies[studyId])

  const onDeltaChangeCallback = (
    delta: string | null,
    deltaChange: string | null,
    deltaOld: string | null,
    changeSource: string | null
  ) => {
    if (!currentStudy) return
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
    setOpenedFromTab(openedFromTab)
  }, [])

  useFocusEffect(
    useCallback(() => {
      setIsFullScreenBible(false)
    }, [setIsFullScreenBible])
  )

  // Show message if study doesn't exist
  if (studyId === '' || !currentStudy) {
    return (
      <Container>
        <Box flex center px={20}>
          <Text fontSize={18} color="grey" textAlign="center" mb={20}>
            {t("Cette étude n'existe plus")}
          </Text>
          <Button onPress={onGoBack ?? (() => router.back())}>{t('Retour aux études')}</Button>
        </Box>
      </Container>
    )
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
      />
      <StudiesDomWrapper
        isReadOnly={isReadOnly}
        onDeltaChangeCallback={onDeltaChangeCallback}
        contentToDisplay={currentStudy.content}
        fontFamily={fontFamily}
        params={params as any}
        studyAtom={studyAtom}
        studyId={studyId}
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

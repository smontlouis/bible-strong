import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { useFocusEffect } from '@react-navigation/native'
import { StackScreenProps } from '@react-navigation/stack'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { isFullScreenBibleValue } from 'src/state/app'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import { MainStackProps } from '~navigation/type'
import { RootState } from '~redux/modules/reducer'
import { updateStudy } from '~redux/modules/user'
import EditStudyHeader from './EditStudyHeader'
import StudiesDomWrapper from './StudiesDOM/StudiesDomWrapper'
import StudyTitlePrompt from './StudyTitlePrompt'
import { openedFromTabAtom } from './atom'
import { StudyTab } from 'src/state/tabs'
import { PrimitiveAtom } from 'jotai/vanilla'

type EditStudyScreenProps = StackScreenProps<MainStackProps, 'EditStudy'> & {
  studyAtom?: PrimitiveAtom<StudyTab>
}

const EditStudyScreen = ({ studyAtom, navigation, route, ...props }: EditStudyScreenProps) => {
  const { t } = useTranslation()

  const studyId = useMemo(() => route.params.studyId, [])
  const canEdit = useMemo(() => route.params.canEdit, [])
  const hasBackButton = useMemo(() => route.params.hasBackButton, [])
  const openedFromTab = useMemo(() => route.params.openedFromTab, [])

  const dispatch = useDispatch()
  const [isReadOnly, setIsReadOnly] = useState(!canEdit)
  const [titlePrompt, setTitlePrompt] = useState<{ id: string; title: string } | false>(false)
  const setOpenedFromTab = useSetAtom(openedFromTabAtom)

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const currentStudy = useSelector((state: RootState) => state.user.bible.studies[studyId])

  const onDeltaChangeCallback = (
    delta: string | null,
    deltaChange: string | null,
    deltaOld: string | null,
    changeSource: string | null
  ) => {
    console.log('delta', delta)
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
      isFullScreenBibleValue.value = false
    }, [])
  )

  // prevent rendering if studyId is not set
  if (studyId === '' || !currentStudy) {
    return null
  }

  return (
    <Container>
      <EditStudyHeader
        isReadOnly={isReadOnly}
        hasBackButton={hasBackButton}
        setTitlePrompt={() =>
          setTitlePrompt({
            id: currentStudy.id,
            title: currentStudy.title,
          })
        }
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
        params={route.params}
        studyAtom={studyAtom}
      />
      <StudyTitlePrompt
        titlePrompt={titlePrompt}
        onClosed={() => setTitlePrompt(false)}
        onSave={(id: string, title: string) => {
          dispatch(updateStudy({ id, title, modified_at: Date.now() }))
        }}
      />
      {isReadOnly && (
        // @ts-ignore
        <FabButton icon="edit" onPress={() => setIsReadOnly(false)} />
      )}
    </Container>
  )
}

export default EditStudyScreen

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import generateUUID from '~helpers/generateUUID'

import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { StackNavigationProp, StackScreenProps } from '@react-navigation/stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { StudyNavigateBibleType } from '~common/types'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import WebViewQuillEditor from '~features/studies/WebViewQuillEditor'
import { RootState } from '~redux/modules/reducer'
import { updateStudy } from '~redux/modules/user'
import EditStudyHeader from './EditStudyHeader'
import StudyTitlePrompt from './StudyTitlePrompt'
import { openedFromTabAtom } from './atom'
import { MainStackProps } from '~navigation/type'
import { isFullScreenBibleValue } from 'src/state/app'
import StudiesDomWrapper from './StudiesDOM/StudiesDomWrapper'

type EditStudyScreenProps = StackScreenProps<MainStackProps, 'EditStudy'>

const EditStudyScreen = ({
  navigation,
  route,
  ...props
}: EditStudyScreenProps) => {
  const { t } = useTranslation()

  const studyId = useMemo(() => route.params.studyId, [])
  const canEdit = useMemo(() => route.params.canEdit, [])
  const hasBackButton = useMemo(() => route.params.hasBackButton, [])
  const openedFromTab = useMemo(() => route.params.openedFromTab, [])

  const dispatch = useDispatch()
  const [isReadOnly, setIsReadOnly] = useState(!canEdit)
  const [titlePrompt, setTitlePrompt] = useState<
    { id: string; title: string } | false
  >(false)
  const setOpenedFromTab = useSetAtom(openedFromTabAtom)

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const currentStudy = useSelector(
    (state: RootState) => state.user.bible.studies[studyId]
  )

  const onDeltaChangeCallback = (
    delta: string | null,
    deltaChange: string | null,
    deltaOld: string | null,
    changeSource: string | null
  ) => {
    dispatch(
      updateStudy({
        id: currentStudy.id,
        content: delta,
        modified_at: Date.now(),
      })
    )
  }

  const navigateBibleView = (type: StudyNavigateBibleType) => {
    navigation.navigate('BibleView', {
      isSelectionMode: type,
    })
  }

  const openBibleView = () => {
    navigation.navigate('BibleView', {
      hasBackButton: true,
    })
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
  if (studyId === '') {
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
        navigateBibleView={navigateBibleView}
      />
      <StudyTitlePrompt
        titlePrompt={titlePrompt}
        onClosed={() => setTitlePrompt(false)}
        onSave={(id: string, title: string) => {
          dispatch(updateStudy({ id, title, modified_at: Date.now() }))
        }}
      />
      {isReadOnly && (
        <FabButton icon="edit" onPress={() => setIsReadOnly(false)} />
      )}
    </Container>
  )
}

export default EditStudyScreen

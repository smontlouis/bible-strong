import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import generateUUID from '~helpers/generateUUID'

import { NavigationStackProp } from 'react-navigation-stack'
import MultipleTagsModal from '~common/MultipleTagsModal'
import { StudyNavigateBibleType } from '~common/types'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import WebViewQuillEditor from '~features/studies/WebViewQuillEditor'
import { RootState } from '~redux/modules/reducer'
import { updateStudy } from '~redux/modules/user'
import EditStudyHeader from './EditStudyHeader'
import StudyTitlePrompt from './StudyTitlePrompt'

type WithStudyProps = {
  navigation: NavigationStackProp
  studyId: string
  canEdit?: boolean
  hasBackButton?: boolean
}

const withStudy = (
  Component: React.ComponentType<WithStudyProps>
): React.ComponentType<WithStudyProps> => ({ navigation, ...props }) => {
  const dispatch = useDispatch()
  const [studyId, setStudyId] = useState('')

  let studyIdParam = navigation.getParam('studyId')
  let canEdit = navigation.getParam('canEdit')

  if (!studyIdParam) {
    studyIdParam = props.studyId
    canEdit = props.canEdit
  }

  useEffect(() => {
    if (studyIdParam) {
      // Update modification_date
      setStudyId(studyIdParam)
    } else {
      // Create Study
      const studyUuid = generateUUID()
      dispatch(
        updateStudy({
          id: studyUuid,
          title: 'Document sans Titre',
          content: null,
          created_at: Date.now(),
          modified_at: Date.now(),
        })
      )
      setStudyId(studyUuid)
    }
  }, [dispatch, studyIdParam])

  if (!studyId) {
    return null
  }

  return (
    <Component
      studyId={studyId}
      canEdit={canEdit}
      navigation={navigation}
      {...props}
    />
  )
}

const EditStudyScreen = ({
  navigation,
  studyId,
  canEdit,
  hasBackButton,
}: WithStudyProps) => {
  const [isReadOnly, setIsReadOnly] = useState(!canEdit)
  const [titlePrompt, setTitlePrompt] = useState<
    { id: string; title: string } | false
  >(false)
  const dispatch = useDispatch()

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const currentStudy = useSelector(
    (state: RootState) => state.user.bible.studies[studyId]
  )

  const onDeltaChangeCallback = (
    delta,
    deltaChange,
    deltaOld,
    changeSource
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

  return (
    <Container pure>
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
      <WebViewQuillEditor
        isReadOnly={isReadOnly}
        onDeltaChangeCallback={onDeltaChangeCallback}
        contentToDisplay={currentStudy.content}
        fontFamily={fontFamily}
        params={navigation.state.params}
        navigateBibleView={navigateBibleView}
        openBibleView={openBibleView}
      />
      <StudyTitlePrompt
        titlePrompt={titlePrompt}
        onClosed={() => setTitlePrompt(false)}
        onSave={(id, title) => {
          dispatch(updateStudy({ id, title, modified_at: Date.now() }))
        }}
      />
      {isReadOnly && (
        <FabButton icon="edit" onPress={() => setIsReadOnly(false)} />
      )}
    </Container>
  )
}

export default withStudy(EditStudyScreen)

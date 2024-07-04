import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import generateUUID from '~helpers/generateUUID'

import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { StackNavigationProp, StackScreenProps } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
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

// type WithStudyProps = {
//   navigation: StackNavigationProp<MainStackProps, 'EditStudy'>
//   route: RouteProp<MainStackProps, 'EditStudy'>
//   studyId: string
//   canEdit?: boolean
//   hasBackButton?: boolean
//   openedFromTab?: boolean
// }

// const withStudy = (
//   Component: React.ComponentType<WithStudyProps>
// ): React.ComponentType<WithStudyProps> => ({ navigation, route, ...props }) => {
//   const dispatch = useDispatch()
//   const [studyId, setStudyId] = useState('')
//   const { t } = useTranslation()

//   let studyIdParam = route.params.studyId // navigation.getParam('studyId')
//   let canEdit = route.params.canEdit // navigation.getParam('canEdit')

//   if (!studyIdParam) {
//     studyIdParam = props.studyId
//     canEdit = props.canEdit
//   }

//   useEffect(() => {
//     if (studyIdParam) {
//       // Update modification_date
//       setStudyId(studyIdParam)
//     } else {
//       // Create Study
//       const studyUuid = generateUUID()
//       dispatch(
//         updateStudy({
//           id: studyUuid,
//           title: t('Document sans titre'),
//           content: null,
//           created_at: Date.now(),
//           modified_at: Date.now(),
//         })
//       )
//       setStudyId(studyUuid)
//     }
//   }, [dispatch, studyIdParam])

//   if (!studyId) {
//     return null
//   }

//   return (
//     <Component
//       // studyId={studyId}
//       canEdit={canEdit}
//       navigation={navigation}
//       route={route}
//       {...props}
//     />
//   )
// }

type EditStudyScreenProps = StackScreenProps<MainStackProps, 'EditStudy'> & {
  studyId?: string
  canEdit?: boolean
}

const EditStudyScreen = ({
  navigation,
  route,
  ...props
}: EditStudyScreenProps) => {
  const { t } = useTranslation()

  const studyIdParam = route.params.studyId ? route.params.studyId : props.studyId
  const canEdit = route.params.canEdit ? route.params.canEdit : props.canEdit
  const hasBackButton = route.params.hasBackButton
  const openedFromTab = route.params.openedFromTab

  const dispatch = useDispatch()
  const [studyId, setStudyId] = useState<string>('')
  const [isReadOnly, setIsReadOnly] = useState(!canEdit)
  const [titlePrompt, setTitlePrompt] = useState<
    { id: string; title: string } | false
  >(false)
  const setOpenedFromTab = useSetAtom(openedFromTabAtom)

  // hook to initialize the studyId state and create a new study if studyIdParam is not provided.
  useEffect(() => {
    if (studyIdParam) {
      setStudyId(studyIdParam)
    }
    else {
      // Create Study
      const studyUuid = generateUUID()
      dispatch(
        updateStudy({
          id: studyUuid,
          title: t('Document sans titre'),
          content: null,
          created_at: Date.now(),
          modified_at: Date.now(),
        })
      )
      setStudyId(studyUuid)
    }
  }, [dispatch, studyIdParam])

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

  // prevent rendering if studyId is not set
  if (studyId === '') {
    return null
  }

  return ( // where does pure come from?
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
        params={route.params}
        navigateBibleView={navigateBibleView}
        openBibleView={openBibleView}
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

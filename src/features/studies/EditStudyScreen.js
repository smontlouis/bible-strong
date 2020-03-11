import React, { useState, useEffect } from 'react'
import { withNavigation } from 'react-navigation'
import compose from 'recompose/compose'
import { useDispatch, connect } from 'react-redux'
import generateUUID from '~helpers/generateUUID'

import { createStudy, updateStudy, uploadStudy } from '~redux/modules/user'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import WebViewQuillEditor from '~features/studies/WebViewQuillEditor'
import MultipleTagsModal from '~common/MultipleTagsModal'
import QuickTagsModal from '~common/QuickTagsModal'
import EditStudyHeader from './EditStudyHeader'
import StudyTitlePrompt from './StudyTitlePrompt'

const withStudy = Component => props => {
  const dispatch = useDispatch()
  const [studyId, setStudyId] = useState(null)

  const { studyId: studyIdParam, canEdit } = props.navigation.state.params || {}

  useEffect(() => {
    if (studyIdParam) {
      // Update modification_date
      setStudyId(studyIdParam)
    } else {
      // Create Study
      const studyId = generateUUID()
      dispatch(createStudy(studyId))
      setStudyId(studyId)
    }
  }, [dispatch, studyIdParam])

  if (!studyId) {
    return null
  }

  return <Component studyId={studyId} canEdit={canEdit} {...props} />
}

class EditStudyScreen extends React.Component {
  state = {
    isReadOnly: true,
    titlePrompt: '',
    multipleTagsItem: false,
    quickTagsModal: false
  }

  componentDidMount() {
    const { canEdit } = this.props

    if (canEdit) {
      this.setState({ isReadOnly: false })
    }
  }

  webViewQuillEditor = React.createRef()

  acceptMethods = dispatchToWebView => {
    this.dispatchToWebView = dispatchToWebView
    this.forceUpdate()
  }

  onDeltaChangeCallback = (delta, deltaChange, deltaOld, changeSource) => {
    const { dispatch, currentStudy } = this.props
    dispatch(updateStudy({ id: currentStudy.id, content: delta }))

    // TODO: See if it's soo expensive
    dispatch(uploadStudy(this.props.currentStudy.id))
  }

  navigateBibleView = type => {
    this.props.navigation.navigate('BibleView', {
      isSelectionMode: type
    })
  }

  openBibleView = () => {
    this.props.navigation.navigate('BibleView', {
      hasBackButton: true
    })
  }

  setTitlePrompt = value => this.setState({ titlePrompt: value })

  setMultipleTagsItem = value => this.setState({ multipleTagsItem: value })

  setQuickTagsModal = value => this.setState({ quickTagsModal: value })

  render() {
    const {
      isReadOnly,
      titlePrompt,
      multipleTagsItem,
      quickTagsModal
    } = this.state

    return (
      <Container pure>
        <EditStudyHeader
          isReadOnly={isReadOnly}
          setTitlePrompt={() =>
            this.setTitlePrompt({
              id: this.props.currentStudy.id,
              title: this.props.currentStudy.title
            })
          }
          setReadOnly={() => {
            this.setState({
              isReadOnly: true,
              quickTagsModal: {
                id: this.props.currentStudy.id,
                entity: 'studies'
              }
            })
            this.props.dispatch(uploadStudy(this.props.currentStudy.id))
          }}
          title={this.props.currentStudy.title}
        />
        <WebViewQuillEditor
          isReadOnly={isReadOnly}
          onDeltaChangeCallback={this.onDeltaChangeCallback}
          contentToDisplay={this.props.currentStudy.content}
          fontFamily={this.props.fontFamily}
          params={this.props.navigation.state.params}
          navigateBibleView={this.navigateBibleView}
          openBibleView={this.openBibleView}
        />
        <StudyTitlePrompt
          titlePrompt={titlePrompt}
          onClosed={() => this.setTitlePrompt(false)}
          onSave={(id, title) => {
            this.props.dispatch(updateStudy({ id, title }))
            this.props.dispatch(uploadStudy(id))
          }}
        />
        <QuickTagsModal
          item={quickTagsModal}
          onClosed={() => this.setQuickTagsModal(false)}
          setMultipleTagsItem={this.setMultipleTagsItem}
        />
        <MultipleTagsModal
          multiple
          item={multipleTagsItem}
          onClosed={() => this.setMultipleTagsItem(false)}
        />
        {isReadOnly && (
          <FabButton
            icon="edit"
            onPress={() => this.setState({ isReadOnly: false })}
            align="flex-end"
          />
        )}
      </Container>
    )
  }
}

export default compose(
  withNavigation,
  withStudy,
  connect(({ user }, ownProps) => {
    return {
      fontFamily: user.fontFamily,
      currentStudy: user.bible.studies[ownProps.studyId]
    }
  })
)(EditStudyScreen)

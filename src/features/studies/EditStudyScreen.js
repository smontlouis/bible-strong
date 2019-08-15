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
import SelectHeaderModal from './SelectHeaderModal'
import SelectBlockModal from './SelectBlockModal'
import SelectColorModal from './SelectColorModal'
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
    activeFormats: {},
    isHeaderModalOpen: false,
    isBlockModalOpen: false,
    isColorModalOpen: false,
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
  }

  setActiveFormats = (formats = {}) => {
    this.setState({ activeFormats: JSON.parse(formats) })
  }

  openHeaderModal = () => this.setState({ isHeaderModalOpen: true })

  closeHeaderModal = () => this.setState({ isHeaderModalOpen: false })

  openBlockModal = () => {
    this.dispatchToWebView('BLUR_EDITOR')
    this.setState({ isBlockModalOpen: true })
  }

  closeBlockModal = () => {
    this.setState({ isBlockModalOpen: false })
  }

  openColorModal = (value = true) => this.setState({ isColorModalOpen: value })

  closeColorModal = () => this.setState({ isColorModalOpen: false })

  navigateBibleView = type => {
    this.props.navigation.navigate('BibleView', {
      isSelectionMode: type
    })
    this.closeBlockModal()
  }

  setTitlePrompt = value => this.setState({ titlePrompt: value })

  setMultipleTagsItem = value => this.setState({ multipleTagsItem: value })

  setQuickTagsModal = value => this.setState({ quickTagsModal: value })

  render() {
    const { isReadOnly, titlePrompt, multipleTagsItem, quickTagsModal } = this.state

    return (
      <Container>
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
          activeFormats={this.state.activeFormats}
          dispatchToWebView={this.dispatchToWebView}
          openHeaderModal={this.openHeaderModal}
          openBlockModal={this.openBlockModal}
          openColorModal={this.openColorModal}
        />
        <WebViewQuillEditor
          isReadOnly={isReadOnly}
          setActiveFormats={this.setActiveFormats}
          shareMethods={this.acceptMethods}
          onDeltaChangeCallback={this.onDeltaChangeCallback}
          contentToDisplay={this.props.currentStudy.content}
          params={this.props.navigation.state.params}
        />
        <SelectHeaderModal
          dispatchToWebView={this.dispatchToWebView}
          activeFormats={this.state.activeFormats}
          isOpen={this.state.isHeaderModalOpen}
          onClosed={this.closeHeaderModal}
        />
        <SelectBlockModal
          dispatchToWebView={this.dispatchToWebView}
          isOpen={this.state.isBlockModalOpen}
          onClosed={this.closeBlockModal}
          navigateBibleView={this.navigateBibleView}
        />
        <SelectColorModal
          dispatchToWebView={this.dispatchToWebView}
          activeFormats={this.state.activeFormats}
          isOpen={this.state.isColorModalOpen}
          onClosed={this.closeColorModal}
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
            icon="edit-2"
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
      currentStudy: user.bible.studies[ownProps.studyId]
    }
  })
)(EditStudyScreen)

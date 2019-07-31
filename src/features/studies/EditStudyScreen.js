import React, { useState, useEffect } from 'react'
import { withNavigation } from 'react-navigation'
import compose from 'recompose/compose'
import { useDispatch, connect } from 'react-redux'
import generateUUID from '~helpers/generateUUID'

import { createStudy, updateStudy } from '~redux/modules/user'
import Container from '~common/ui/Container'
import WebViewQuillEditor from '~features/studies/studiesWebView/WebViewQuillEditor'

import EditStudyHeader from './EditStudyHeader'
import SelectHeaderModal from './SelectHeaderModal'
import SelectBlockModal from './SelectBlockModal'
import SelectColorModal from './SelectColorModal'

const withStudy = (Component) => props => {
  const dispatch = useDispatch()
  const [studyId, setStudyId] = useState(null)

  let { studyId: studyIdParam } = props.navigation.state.params || {}

  useEffect(() => {
    if (studyIdParam) {
      // Update modification_date
      setStudyId(studyIdParam)
    } else {
      // Create Study
      const studyId = generateUUID()
      dispatch(createStudy(studyId))
      setStudyId(studyId)
      console.log('Loaded true: ', +studyId)
    }
  }, [])

  if (!studyId) {
    return null
  }

  return (
    <Component studyId={studyId} {...props} />
  )
}

class EditStudyScreen extends React.Component {
  state = {
    activeFormats: {},
    isHeaderModalOpen: false,
    isBlockModalOpen: false,
    isColorModalOpen: false
  }

  webViewQuillEditor = React.createRef()

  acceptMethods = (dispatchToWebView) => {
    this.dispatchToWebView = dispatchToWebView
    this.forceUpdate()
  }

  onDeltaChangeCallback = (delta, deltaChange, deltaOld, changeSource) => {
    const { dispatch, currentStudy } = this.props
    dispatch(updateStudy({ id: currentStudy.id, content: delta }))
  };

  setActiveFormats = (formats = {}) => {
    this.setState({ activeFormats: JSON.parse(formats) })
  }

  openHeaderModal = () => this.setState({ isHeaderModalOpen: true })
  closeHeaderModal = () => this.setState({ isHeaderModalOpen: false })

  openBlockModal = () => this.setState({ isBlockModalOpen: true })
  closeBlockModal = () => this.setState({ isBlockModalOpen: false })

  openColorModal = (value = true) => this.setState({ isColorModalOpen: value })
  closeColorModal = () => this.setState({ isColorModalOpen: false })

  navigateBibleView = (type) => {
    this.props.navigation.navigate('BibleView', {
      isSelectionMode: type
    })
    this.closeBlockModal()
  }

  render () {
    return (
      <Container>
        <EditStudyHeader
          activeFormats={this.state.activeFormats}
          dispatchToWebView={this.dispatchToWebView}
          openHeaderModal={this.openHeaderModal}
          openBlockModal={this.openBlockModal}
          openColorModal={this.openColorModal}
        />
        <WebViewQuillEditor
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

import React from 'react'
import { withNavigation } from 'react-navigation'

import Container from '~common/ui/Container'
import WebViewQuillEditor from '~features/studies/studiesWebView/WebViewQuillEditor'

import EditStudyHeader from './EditStudyHeader'
import MockContent from './studiesWebView/src/editor/MockContent'
import ChooseHeaderModal from './ChooseHeaderModal'
import SelectBlockModal from './SelectBlockModal'

class EditStudyScreen extends React.Component {
  state = {
    editorMessageDelta: MockContent,
    activeFormats: {},
    isHeaderModalOpen: false,
    isBlockModalOpen: false
  }

  webViewQuillEditor = React.createRef()

  acceptMethods = (dispatchToWebView) => {
    this.dispatchToWebView = dispatchToWebView
    this.forceUpdate()
  }

  getDeltaCallback = response => {
    console.log('get delta')
  };

  onDeltaChangeCallback = (delta, deltaChange, deltaOld, changeSource) => {
    console.log(delta)
  };

  setActiveFormats = (formats = {}) => {
    this.setState({ activeFormats: JSON.parse(formats) })
  }

  openHeaderModal = () => this.setState({ isHeaderModalOpen: true })
  closeHeaderModal = () => this.setState({ isHeaderModalOpen: false })

  openBlockModal = () => this.setState({ isBlockModalOpen: true })
  closeBlockModal = () => this.setState({ isBlockModalOpen: false })

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
        />
        <WebViewQuillEditor
          setActiveFormats={this.setActiveFormats}
          shareMethods={this.acceptMethods}
          getDeltaCallback={this.getDeltaCallback}
          onDeltaChangeCallback={this.onDeltaChangeCallback}
          contentToDisplay={this.state.editorMessageDelta}
          params={this.props.navigation.state.params}
        />
        <ChooseHeaderModal
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
      </Container>
    )
  }
}

export default withNavigation(EditStudyScreen)

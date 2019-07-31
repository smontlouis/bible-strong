import React, { useState, useEffect } from 'react'
import { withNavigation } from 'react-navigation'
import compose from 'recompose/compose'
import { connect } from 'react-redux'

import Container from '~common/ui/Container'
import WebViewQuillViewer from '~features/studies/studiesWebView/WebViewQuillViewer'

import Header from '~common/Header'
class ViewStudyScreen extends React.Component {
  render () {
    return (
      <Container>
        <Header
          hasBackButton
          title='truc'
        />
        <WebViewQuillViewer
          contentToDisplay={this.props.currentStudy.content}
        />
      </Container>
    )
  }
}

export default compose(
  withNavigation,
  connect(({ user }, ownProps) => {
    const { studyId } = ownProps.navigation.state.params || {}
    return {
      currentStudy: user.bible.studies[studyId]
    }
  })
)(ViewStudyScreen)

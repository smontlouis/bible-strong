import React, { Component, createRef } from 'react'
import { WebView } from 'react-native'
import { compose } from 'recompose'
import { connect } from 'react-redux'

import * as BibleActions from '~redux/modules/bible'
import bibleWebView from './bibleWebView/dist/index.html'
import { NAVIGATE_TO_BIBLE_VERSE_DETAIL } from './bibleWebView/src/dispatch'

class BibleWebView extends Component {
  webViewRef = createRef();

  componentDidUpdate () {
    this.sendDataToWebView()
  }

  // Receives all data from webview
  receiveDataFromWebView = (e) => {
    const action = JSON.parse(e.nativeEvent.data)
    switch (action.type) {
      case NAVIGATE_TO_BIBLE_VERSE_DETAIL: {
        console.log(action.payload)
        this.props.setSelectedVerse(Number(action.payload))
        this.props.navigation.navigate('BibleVerseDetail')
      }
    }
  }

  sendDataToWebView = () => {
    const { arrayVerses } = this.props
    const webView = this.webViewRef.current

    if (webView === null) {
      return
    }

    // Sending all data from webview
    const message = JSON.stringify({ arrayVerses })
    webView.postMessage(message)
  }

  render () {
    return (
      <WebView
        useWebKit
        onLoad={this.sendDataToWebView}
        onMessage={this.receiveDataFromWebView}
        originWhitelist={['*']}
        ref={this.webViewRef}
        source={bibleWebView}
      />
    )
  }
}

export default compose(
  connect(null, { ...BibleActions })
)(BibleWebView)

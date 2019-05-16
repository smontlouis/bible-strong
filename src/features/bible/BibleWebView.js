import React, { Component, createRef } from 'react'
import { WebView } from 'react-native'
import bibleWebView from './bibleWebView/dist/index.html'

export default class MyInlineWeb extends Component {
  webViewRef = createRef();

  componentDidUpdate () {
    this.loadData()
  }

  handleLoad = () => {
    this.loadData()
  }

  onMessage = (e) => {
    console.log(e.nativeEvent.data)
  }

  loadData = () => {
    const { arrayVerses } = this.props
    const webView = this.webViewRef.current

    if (webView === null) {
      return
    }

    const message = JSON.stringify({ arrayVerses })
    webView.postMessage(message)
  }

  render () {
    return (
      <WebView
        useWebKit
        onLoad={this.handleLoad}
        onMessage={this.onMessage}
        originWhitelist={['*']}
        ref={this.webViewRef}
        source={bibleWebView}
      />
    )
  }
}

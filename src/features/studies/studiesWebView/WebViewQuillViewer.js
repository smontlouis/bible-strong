import React, { createRef } from 'react'
import { withNavigation } from 'react-navigation'
import {
  View,
  ActivityIndicator,
  Alert,
  WebView
} from 'react-native'

// import { WebView } from 'react-native-webview'

import reactQuillViewerHTML from './build/reactQuillViewer-index.html'

class WebViewQuillViewer extends React.Component {
  webViewRef = createRef();

  dispatchToWebView = (type, payload) => {
    const webView = this.webViewRef.current

    if (webView) {
      console.log('RN DISPATCH: ', type)
      webView.postMessage(
        JSON.stringify({
          type,
          payload
        }),
        '*'
      )
    }
  };

  handleMessage = (event) => {
    let msgData
    try {
      msgData = JSON.parse(event.nativeEvent.data)
      // console.log('RN RECEIVE: ', msgData.type)

      switch (msgData.type) {
        case 'EDITOR_LOADED':
          this.editorLoaded()
          break
        case 'CONSOLE_LOG': {
          console.log(`%c${msgData.payload}`, 'color:black;background-color:#81ecec')
          return
        }
        default:
          console.warn(
            `WebViewQuillViewer Error: Unhandled message type received "${
              msgData.type
            }"`
          )
      }
    } catch (err) {
      console.warn(err)
    }
  };

  onWebViewLoaded = () => {
    this.dispatchToWebView('LOAD_EDITOR')
  };

  editorLoaded = () => {
    if (this.props.contentToDisplay) {
      console.log('Content to Display: ', this.props.contentToDisplay)
      this.dispatchToWebView('SET_CONTENTS', {
        delta: this.props.contentToDisplay
      })
    }
  };

  showLoadingIndicator = () => {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color='green' />
      </View>
    )
  };

  onError = (error) => {
    Alert.alert('WebView onError', error, [
      { text: 'OK', onPress: () => console.log('OK Pressed') }
    ])
  };

  renderError = (error) => {
    Alert.alert('WebView renderError', error, [
      { text: 'OK', onPress: () => console.log('OK Pressed') }
    ])
  };

  render = () => {
    return (
      <View style={{ flex: 1 }}>
        <WebView
          useWebKit
          originWhitelist={['*']}
          ref={this.webViewRef}
          source={reactQuillViewerHTML}
          onLoadEnd={this.onWebViewLoaded}
          onMessage={this.handleMessage}
          renderLoading={this.showLoadingIndicator}
          renderError={this.renderError}
          onError={this.onError}
          allowFileAccess
        />
      </View>
    )
  };
}

// Specifies the default values for props:
WebViewQuillViewer.defaultProps = {
  theme: 'snow'
}

export default withNavigation(WebViewQuillViewer)

/********************************************
 * WebViewQuillEditor.js
 * A Quill.js editor component for use in react-native
 * applications that need to avoid using native code
 *
 */
import React from 'react'
import {
  View,
  ActivityIndicator,
  WebView,
  Alert
} from 'react-native'
import PropTypes from 'prop-types'

// path to the file that the webview will load
import reactQuillEditorHTML from './build/reactQuillEditor-index.html'

export default class WebViewQuillEditor extends React.Component {
  constructor () {
    super()
    this.webview = null
  }

  createWebViewRef = (webview) => {
    this.webview = webview
  };

  handleMessage = (event) => {
    let msgData
    try {
      msgData = JSON.parse(event.nativeEvent.data)

      this.sendMessage('MESSAGE_ACKNOWLEDGED')

      switch (msgData.type) {
        case 'EDITOR_LOADED':
          this.editorLoaded()
          break
        case 'EDITOR_SENT':
          this.props.getEditorCallback(msgData.payload.editor)
          break
        case 'TEXT_CHANGED':
          if (this.props.onDeltaChangeCallback) {
            delete msgData.payload.type
            const {
              delta,
              deltaChange,
              deltaOld,
              changeSource
            } = msgData.payload
            this.props.onDeltaChangeCallback(
              delta,
              deltaChange,
              deltaOld,
              changeSource
            )
          }
          break
        case 'RECEIVE_DELTA':
          if (this.props.getDeltaCallback) { this.props.getDeltaCallback(msgData.payload) }
          break
        default:
          console.warn(
            `WebViewQuillEditor Error: Unhandled message type received "${
              msgData.type
            }"`
          )
      }
    } catch (err) {
      console.warn(err)
    }
  };

  onWebViewLoaded = () => {
    this.sendMessage('LOAD_EDITOR')
    if (this.props.hasOwnProperty('onLoad')) {
      this.props.onLoad()
    }
    if (this.props.hasOwnProperty('getEditorCallback')) {
      this.sendMessage('SEND_EDITOR')
    }
  };

  editorLoaded = () => {
    // send the content to the editor if we have it
    if (this.props.hasOwnProperty('contentToDisplay')) {
      console.log('Content to Display: ', this.props.contentToDisplay)
      this.sendMessage('SET_CONTENTS', {
        delta: this.props.contentToDisplay
      })
    }
    if (this.props.hasOwnProperty('htmlContentToDisplay')) {
      this.sendMessage('SET_HTML_CONTENTS', {
        html: this.props.htmlContentToDisplay
      })
    }
  };

  sendMessage = (type, payload) => {
    // only send message when webview is loaded
    if (this.webview) {
      this.webview.postMessage(
        JSON.stringify({
          type,
          payload
        }),
        '*'
      )
    }
  };

  // get the contents of the editor.  The contents will be in the Delta format
  // defined here: https://quilljs.com/docs/delta/
  getDelta = () => {
    this.sendMessage('GET_DELTA')
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
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <WebView
          useWebKit
          originWhitelist={['*']}
          ref={this.createWebViewRef}
          source={reactQuillEditorHTML}
          onLoadEnd={this.onWebViewLoaded}
          onMessage={this.handleMessage}
          renderLoading={this.showLoadingIndicator}
          renderError={this.renderError}
          onError={this.onError}
          mixedContentMode={'always'}
          domStorageEnabled
        />
      </View>
    )
  };
}

WebViewQuillEditor.propTypes = {
  getDeltaCallback: PropTypes.func,
  onDeltaChangeCallback: PropTypes.func,
  onLoad: PropTypes.func
}

// Specifies the default values for props:
WebViewQuillEditor.defaultProps = {
  theme: 'snow'
}

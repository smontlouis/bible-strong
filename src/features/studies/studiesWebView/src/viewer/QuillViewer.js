import Quill from '../quill.js'
import React from 'react'
import PropTypes from 'prop-types'

const util = require('util')
const MESSAGE_PREFIX = 'react-native-webview-quilljs'

const BROWSER_TESTING_ENABLED = false // flag to enable testing directly in browser
const SHOW_DEBUG_INFORMATION = false

let messageCounter = 0

export default class ReactQuillViewer extends React.Component {
  constructor (props) {
    super(props)
    this.messageQueue = []
    this.state = {
      viewer: null,
      debugMessages: [],
      readyToSendNextMessage: true
    }
  }

  // print passed information in an html element; useful for debugging
  // since console.log and debug statements won't work in a conventional way
  printElement = data => {
    if (SHOW_DEBUG_INFORMATION) {
      let message = ''
      if (typeof data === 'object') {
        message = util.inspect(data, { showHidden: false, depth: null })
      } else if (typeof data === 'string') {
        message = data
      }
      this.setState({
        debugMessages: this.state.debugMessages.concat([message])
      })
      console.log(message)
    }
  }

  componentDidMount () {
    document.addEventListener('message', this.handleMessage)

    this.printElement(`component mounted`)
    console.log('mounted')
    if (BROWSER_TESTING_ENABLED) {
      this.loadViewer()
    }
  }

  // load the viewer.  Don't do it in componentMount so that we can pass a theme
  // to this component based on component props
  loadViewer = theme => {
    let that = this
    this.printElement(`loading viewer, theme = ${theme}`)
    this.setState(
      {
        viewer: new Quill('#viewer', {
          readOnly: true,
          theme: theme || 'bubble',
          bounds: '#Quill-Viewer-Container'
        })
      },
      () => {
        that.printElement(`viewer initialized`)
        that.addMessageToQueue('VIEWER_LOADED', {
          type: 'success'
        })
      }
    )
  }

  componentWillUnmount () {
    if (document) {
      document.removeEventListener('message', this.handleMessage)
    } else if (window) {
      window.removeEventListener('message', this.handleMessage)
    }
  }

  addMessageToQueue = (type, payload) => {
    this.messageQueue.push(
      JSON.stringify({
        messageID: messageCounter++,
        prefix: MESSAGE_PREFIX,
        type,
        payload
      })
    )
    this.printElement(`adding message ${messageCounter} to queue: ${type}`)
    this.printElement(`queue length: ${this.messageQueue.length}`)
    if (this.state.readyToSendNextMessage) {
      this.printElement(`sending message`)
      this.sendNextMessage()
    }
  }

  sendNextMessage = () => {
    if (this.messageQueue.length > 0) {
      const nextMessage = this.messageQueue.shift()
      this.printElement(`sending message ${nextMessage}`)
      if (document.hasOwnProperty('postMessage')) {
        document.postMessage(nextMessage, '*')
      } else if (window.hasOwnProperty('postMessage')) {
        window.postMessage(nextMessage, '*')
      } else {
        this.printElement(`ERROR: unable to find postMessage`)
      }
      this.setState({ readyToSendNextMessage: false })
    }
  }

  handleMessage = event => {
    this.printElement(`viewer received message`)
    this.printElement(
      util.inspect(event.data, {
        showHidden: false,
        depth: null
      })
    )

    let msgData
    try {
      msgData = JSON.parse(event.data)
      if (
        msgData.hasOwnProperty('prefix') &&
        msgData.prefix === MESSAGE_PREFIX
      ) {
        // this.printElement(msgData);
        switch (msgData.type) {
          case 'LOAD_VIEWER':
            this.loadViewer()
            break
          case 'SEND_VIEWER':
            this.addMessageToQueue('VIEWER_SENT', { viewer: this.state.viewer })
            break
          case 'SEND_VIEWER':
            this.addMessageToQueue('VIEWER_SENT', { viewer: this.state.viewer })
            break
          case 'SET_CONTENTS':
            this.state.viewer.setContents(msgData.payload.ops)
            break
          case 'SET_HTML_CONTENTS':
            this.state.viewer.clipboard.dangerouslyPasteHTML(
              msgData.payload.html
            )
            break
          case 'MESSAGE_ACKNOWLEDGED':
            this.printElement(`received MESSAGE_ACKNOWLEDGED`)
            this.setState({ readyToSendNextMessage: true })
            this.setState({ readyToSendNextMessage: true }, () => {
              this.sendNextMessage()
            })
            break
          default:
            printElement(
              `reactQuillViewer Error: Unhandled message type received "${
                msgData.type
              }"`
            )
        }
      }
    } catch (err) {
      this.printElement(`reactQuillViewer error: ${err}`)
    }
  }

  render () {
    return (
      <div
        id='Quill-Viewer-Container'
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            paddingVertical: 5
          }}
        >
          <div
            id='viewer'
            style={{
              fontSize: '20px',
              height: '100%'
            }}
          />
        </div>
        {SHOW_DEBUG_INFORMATION && (
          <div
            style={{
              backgroundColor: 'rgba(50, 50, 200, 1)',
              maxHeight: 200,
              overflow: 'auto',
              padding: 5
            }}
            id='messages'
          >
            <ul>
              {this.state.debugMessages.map((message, index) => {
                return <li key={index}>{message}</li>
              })}
            </ul>
          </div>
        )}
      </div>
    )
  }
}

import Quill from '../quill.js'
import './InlineVerse'
import './ModuleInlineVerse'

import '../quill.snow.css'

import React from 'react'
import Toolbar from './Toolbar'
import debounce from 'debounce'

const util = require('util')

const BROWSER_TESTING_ENABLED = true
const SHOW_DEBUG_INFORMATION = true

export default class ReactQuillEditor extends React.Component {
  state = {
    editor: null,
    debugMessages: [],
    readyToSendNextMessage: true
  }

  messageQueue = []

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

    this.quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: {
          container: '#toolbar'
        },
        'inline-verse': true
      },
      placeholder: 'Créer votre étude...'
    })

    this.quill.setContents([
      { insert: 'Change the ' },
      { insert: 'World!', attributes: { bold: true } },
      { insert: '\n' }
    ])

    if (BROWSER_TESTING_ENABLED) {
      this.loadEditor()
    }
  }

  onChangeText = (delta, oldDelta, source) => {
    this.addMessageToQueue('TEXT_CHANGED', {
      type: 'success',
      deltaChange: delta,
      delta: this.state.editor.getContents(),
      deltaOld: oldDelta,
      changeSource: source
    })
  }

  addTextChangeEventToEditor = () => {
    this.state.editor.on('text-change', debounce(this.onChangeText, 500))
  }

  loadEditor = theme => {
    let that = this
    this.printElement(`loading editor`)
    this.setState(
      {
        editor: this.quill
      },
      () => {
        that.printElement(`editor initialized`)
        that.addMessageToQueue('EDITOR_LOADED', {
          type: 'success',
          delta: this.state.editor.getContents()
        })
        that.addTextChangeEventToEditor()
      }
    )
  }

  componentWillUnmount () {
    document.removeEventListener('message', this.handleMessage)
  }

  addMessageToQueue = (type, payload) => {
    this.messageQueue.push(
      JSON.stringify({
        type,
        payload
      })
    )
    if (this.state.readyToSendNextMessage) {
      this.sendNextMessage()
    }
  }

  sendNextMessage = () => {
    if (this.messageQueue.length > 0) {
      const nextMessage = this.messageQueue.shift()
      window.postMessage(nextMessage, '*')
      this.setState({ readyToSendNextMessage: false })
    }
  }

  handleMessage = event => {
    this.printElement(
      util.inspect(event.data, {
        showHidden: false,
        depth: null
      })
    )

    let msgData
    try {
      msgData = JSON.parse(event.data)

      switch (msgData.type) {
        case 'LOAD_EDITOR':
          this.loadEditor()
          break
        case 'SEND_EDITOR':
          this.addMessageToQueue('EDITOR_SENT', { editor: this.state.editor })
          break
        case 'GET_DELTA':
          this.addMessageToQueue('RECEIVE_DELTA', {
            type: 'success',
            delta: this.state.editor.getContents()
          })
          break
        case 'SET_CONTENTS':
          this.state.editor.setContents(msgData.payload.delta)
          break
        case 'SET_HTML_CONTENTS':
          this.state.editor.clipboard.dangerouslyPasteHTML(
            msgData.payload.html
          )
          break
        case 'MESSAGE_ACKNOWLEDGED':
          this.setState({ readyToSendNextMessage: true }, () => {
            this.sendNextMessage()
          })
          break
        default:
          this.printElement(
            `reactQuillEditor Error: Unhandled message type received "${
              msgData.type
            }"`
          )
      }
    } catch (err) {
      this.printElement(`reactQuillEditor error: ${err}`)
    }
  }

  render () {
    return (
      <React.Fragment>
        <Toolbar />
        <div
          id='editor'
          style={{
            fontSize: '20px',
            height: '100%'
          }}
        />
        {
          (SHOW_DEBUG_INFORMATION && BROWSER_TESTING_ENABLED) &&
          <div
            style={{
              backgroundColor: 'rgba(200, 200, 200, 1)',
              fontFamily: 'arial',
              maxHeight: 200,
              overflow: 'auto',
              padding: 5,
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0
            }}
            id='messages'
          >
            <ul>
              {this.state.debugMessages.map((message, index) => {
                return <li key={index}>{message}</li>
              })}
            </ul>
          </div>
        }
      </React.Fragment>
    )
  }
}

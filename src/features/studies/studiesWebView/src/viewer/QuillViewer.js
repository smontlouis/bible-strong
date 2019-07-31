import Quill from '../quill.js'
import '../editor/InlineVerse'
import '../editor/InlineStrong'
import '../editor/VerseBlock'
import '../editor/StrongBlock'
import '../editor/DividerBlock'

import '../quill.snow.css'

import React from 'react'

import { dispatch, dispatchConsole } from '../dispatch'
import MockContent from '../editor/MockContent.js'

const BROWSER_TESTING_ENABLED = false

export default class ReactQuillEditor extends React.Component {
  componentDidMount () {
    document.addEventListener('message', this.handleMessage)
    dispatchConsole(`component mounted`)

    if (BROWSER_TESTING_ENABLED) {
      this.loadEditor()
      this.quill.setContents(MockContent, Quill.sources.SILENT)
    }
  }

  loadEditor = theme => {
    this.quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: false
      },
      readOnly: true
    })

    dispatchConsole(`loading editor`)

    dispatchConsole(`editor initialized`)
    dispatch('EDITOR_LOADED', {
      type: 'success',
      delta: this.quill.getContents()
    })
  }

  componentWillUnmount () {
    document.removeEventListener('message', this.handleMessage)
  }

  handleMessage = event => {
    try {
      const msgData = JSON.parse(event.data)
      dispatchConsole(msgData.type)

      switch (msgData.type) {
        case 'LOAD_EDITOR':
          this.loadEditor()
          break
        case 'SET_CONTENTS':
          this.quill.setContents(msgData.payload.delta, Quill.sources.SILENT)
          break
        case 'SET_HTML_CONTENTS':
          this.quill.clipboard.dangerouslyPasteHTML(
            msgData.payload.html
          )
          break
        default:
          dispatchConsole(
            `reactQuillEditor Error: Unhandled message type received "${
              msgData.type
            }"`
          )
      }
    } catch (err) {
      dispatchConsole(`reactQuillEditor error: ${err}`)
    }
  }

  render () {
    return (
      <React.Fragment>
        <div id='editor' />
        {/* <Toolbar /> */}
      </React.Fragment>
    )
  }
}

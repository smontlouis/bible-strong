import Quill from '../quill.js'
import './InlineVerse'
import './InlineStrong'
import './VerseBlock'
import './StrongBlock'

import './ModuleFormat'
import './ModuleInlineVerse'
import './ModuleBlockVerse'
import './DividerBlock'
import Toolbar from './Toolbar'
import '../quill.snow.css'

import React from 'react'
import debounce from 'debounce'
import { dispatch, dispatchConsole } from '../dispatch'
import MockContent from './MockContent.js'

const BROWSER_TESTING_ENABLED = false

export default class ReactQuillEditor extends React.Component {
  state = {
    editor: null
  }

  componentDidMount () {
    document.addEventListener('message', this.handleMessage)
    dispatchConsole(`component mounted`)

    this.quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: false,
        'inline-verse': true,
        'block-verse': true,
        'format': true
      },
      placeholder: 'Créer votre étude...'
    })

    this.quill.setContents(MockContent, Quill.sources.SILENT)
    this.quill.focus()

    if (BROWSER_TESTING_ENABLED) {
      this.loadEditor()
    }
  }

  onChangeText = (delta, oldDelta, source) => {
    dispatch('TEXT_CHANGED', {
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
    dispatchConsole(`loading editor`)
    this.setState(
      {
        editor: this.quill
      },
      () => {
        dispatchConsole(`editor initialized`)
        dispatch('EDITOR_LOADED', {
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

  handleMessage = event => {
    try {
      const msgData = JSON.parse(event.data)
      dispatchConsole(msgData.type)

      switch (msgData.type) {
        case 'LOAD_EDITOR':
          this.loadEditor()
          break
        case 'SEND_EDITOR':
          this.dispatch('EDITOR_SENT', { editor: this.state.editor })
          break
        case 'GET_DELTA':
          this.dispatch('RECEIVE_DELTA', {
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
        case 'GET_BIBLE_VERSES':
          this.inlineVerseModule = this.quill.getModule('inline-verse')
          this.inlineVerseModule.receiveVerseLink(msgData.payload)
          break
        case 'GET_BIBLE_STRONG':
          this.inlineVerseModule = this.quill.getModule('inline-verse')
          this.inlineVerseModule.receiveStrongLink(msgData.payload)
          break
        case 'GET_BIBLE_VERSES_BLOCK':
          this.blockVerseModule = this.quill.getModule('block-verse')
          this.blockVerseModule.receiveVerseBlock(msgData.payload)
          break
        case 'GET_BIBLE_STRONG_BLOCK':
          this.blockVerseModule = this.quill.getModule('block-verse')
          this.blockVerseModule.receiveStrongBlock(msgData.payload)
          break
        case 'BLOCK_DIVIDER':
          const range = this.quill.getSelection(true)
          this.quill.insertEmbed(range.index, 'divider', true, Quill.sources.USER)
          this.quill.setSelection(range.index + 1, Quill.sources.SILENT)
          break
        case 'TOGGLE_FORMAT': {
          this.formatModule = this.quill.getModule('format')
          const type = msgData.payload.type
          const value = msgData.payload.value

          dispatchConsole(`${type} ${value}`)

          switch (type) {
            case 'UNDO':
              this.quill.history.undo()
              break
            case 'REDO':
              this.quill.history.redo()
              break
            case 'BOLD':
              this.formatModule.format('bold', value)
              break
            case 'ITALIC':
              this.formatModule.format('italic', value)
              break
            case 'UNDERLINE':
              this.formatModule.format('underline', value)
              break
            case 'BLOCKQUOTE':
              this.formatModule.format('blockquote', value)
              break
            case 'LIST':
              this.formatModule.format('list', value)
              break
            case 'HEADER':
              this.formatModule.format('header', value)
              break
            case 'BACKGROUND':
              this.formatModule.format('background', value)
              break
          }
          break
        }
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

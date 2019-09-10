import './InlineVerse'
import './InlineStrong'
import './VerseBlock'
import './StrongBlock'

import './ModuleFormat'
import './ModuleInlineVerse'
import './ModuleBlockVerse'
import './DividerBlock'
import './quill.snow.css'

import React from 'react'
import debounce from 'debounce'
import Quill from './quill'
import { dispatch, dispatchConsole, dispatchThrow } from './dispatch'

const BROWSER_TESTING_ENABLED = process.env.NODE_ENV !== 'production'

export default class ReactQuillEditor extends React.Component {
  componentDidMount() {
    document.addEventListener('messages', this.handleMessage)
    dispatchConsole('component mounted')

    if (BROWSER_TESTING_ENABLED) {
      // this.loadEditor()
      // const MockContent = require('./MockContent').default
      // this.quill.setContents(MockContent, Quill.sources.SILENT)
      // this.quill.enable()
      // // Load font
      // const literate = require('./literata').default
      // const style = document.createElement('style')
      // style.innerHTML = literate
      // document.head.appendChild(style)
    }
  }

  onChangeText = (delta, oldDelta, source) => {
    dispatch('TEXT_CHANGED', {
      type: 'success',
      delta: this.quill.getContents(),
      deltaChange: delta,
      deltaOld: oldDelta,
      changeSource: source
    })
  }

  addTextChangeEventToEditor = () => {
    this.quill.on('text-change', debounce(this.onChangeText, 500))
  }

  loadEditor = () => {
    this.quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: BROWSER_TESTING_ENABLED,
        'inline-verse': true,
        'block-verse': true,
        format: true
      },
      placeholder: 'Créer votre étude...',
      readOnly: true
    })

    dispatchConsole('loading editor')
    this.quill.focus()

    dispatchConsole('editor initialized')
    dispatch('EDITOR_LOADED', {
      type: 'success',
      delta: this.quill.getContents()
    })
    this.addTextChangeEventToEditor()
  }

  componentWillUnmount() {
    document.removeEventListener('messages', this.handleMessage)
  }

  handleMessage = event => {
    try {
      const msgData = event.detail

      switch (msgData.type) {
        case 'LOAD_EDITOR':
          this.loadEditor()
          break
        case 'SET_CONTENTS':
          this.quill.setContents(msgData.payload.delta, Quill.sources.SILENT)
          break
        case 'SET_HTML_CONTENTS':
          this.quill.clipboard.dangerouslyPasteHTML(msgData.payload.html)
          break
        case 'CAN_EDIT':
          this.quill.enable()
          this.quill.focus()
          break
        case 'READ_ONLY':
          this.quill.blur()
          this.quill.enable(false)
          break
        case 'FOCUS_EDITOR':
          this.quill.focus()
          setTimeout(() => {
            document.querySelector('.ql-editor').focus()
          }, 0)
          break
        case 'BLUR_EDITOR':
          this.quill.blur()
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
        case 'BLOCK_DIVIDER': {
          const range = this.quill.getSelection(true)
          this.quill.insertEmbed(range.index, 'divider', true, Quill.sources.USER)
          this.quill.setSelection(range.index + 1, Quill.sources.SILENT)
          break
        }
        case 'TOGGLE_FORMAT': {
          this.formatModule = this.quill.getModule('format')
          const { type } = msgData.payload
          const { value } = msgData.payload

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
            case 'COLOR':
              this.formatModule.format('color', value)
              break
            default:
              break
          }
          break
        }
        default:
          dispatchConsole(
            `reactQuillEditor Error: Unhandled message type received "${msgData.type}"`
          )
      }
    } catch (err) {
      dispatchThrow(`reactQuillEditor error: ${err}`)
    }
  }

  render() {
    return (
      <>
        <div id="editor" />
        {/* <Toolbar /> */}
      </>
    )
  }
}

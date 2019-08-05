import Quill from './quill.js'
import { dispatch, dispatchConsole } from './dispatch'

const Module = Quill.import('core/module')

class ModuleBlockVerse extends Module {
  constructor (quill, options) {
    super(quill, options)
    this.quill = quill
  }

  openVerseBlock = () => {
    dispatch('SELECT_BIBLE_VERSE_BLOCK')
  }

  receiveVerseBlock = (data) => {
    dispatchConsole(`VERSE RECEIVED: ${JSON.stringify(data)}`)

    const { title, content, version, verses } = data

    const range = this.quill.getSelection(true)
    this.quill.insertEmbed(range.index, 'block-verse', { title, content, version, verses }, Quill.sources.USER)
    this.quill.setSelection(range.index + 1, Quill.sources.SILENT)
  }

  openStrongBlock = (value) => {
    dispatch('SELECT_BIBLE_STRONG_BLOCK')
  }

  receiveStrongBlock = (data) => {
    dispatchConsole(`STRONG RECEIVED: ${JSON.stringify(data)}`)

    const { title, code, strongType, phonetique, definition, translatedBy, book, original } = data
    const range = this.quill.getSelection(true)
    this.quill.insertEmbed(range.index, 'block-strong', { title, code, strongType, phonetique, definition, translatedBy, book, original }, Quill.sources.USER)
    this.quill.setSelection(range.index + 1, Quill.sources.SILENT)
  }
}

Quill.register({
  'modules/block-verse': ModuleBlockVerse
}, true)

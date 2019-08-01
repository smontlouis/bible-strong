import Quill from './quill.js'
import { dispatch, dispatchConsole } from './dispatch'

const Module = Quill.import('core/module')

class ModuleBlockVerse extends Module {
  static DEFAULTS = {
    buttonIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-8-2h2v-4h4v-2h-4V7h-2v4H7v2h4z"/></svg>'
  }

  constructor (quill, options) {
    super(quill, options)

    this.quill = quill
    this.toolbar = quill.getModule('toolbar')

    if (typeof this.toolbar !== 'undefined') {
      this.toolbar.addHandler('block-verse', this.openVerseBlock)
      this.toolbar.addHandler('block-strong', this.openStrongBlock)
    }

    const verseLinkBtn = document.querySelector('.ql-block-verse')
    if (verseLinkBtn) {
      verseLinkBtn.innerHTML = options.buttonIcon
    }

    const strongLinkBtn = document.querySelector('.ql-block-strong')
    if (strongLinkBtn) {
      strongLinkBtn.innerHTML = options.buttonIcon
    }
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

    const { title, code, strongType, phonetique, definition, translatedBy } = data
    const range = this.quill.getSelection(true)
    this.quill.insertEmbed(range.index, 'block-strong', { title, code, strongType, phonetique, definition, translatedBy }, Quill.sources.USER)
    this.quill.setSelection(range.index + 1, Quill.sources.SILENT)
  }
}

Quill.register({
  'modules/block-verse': ModuleBlockVerse
}, true)

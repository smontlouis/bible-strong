import Quill from '../quill.js'
import { dispatch, dispatchConsole } from '../dispatch'

const Module = Quill.import('core/module')

class ModuleBlockVerse extends Module {
  constructor (quill, options) {
    super(quill, options)

    this.quill = quill
    this.toolbar = quill.getModule('toolbar')

    if (typeof this.toolbar !== 'undefined') {
      this.toolbar.addHandler('block-verse', this.openVerseBlock)
      this.toolbar.addHandler('block-strong', this.openStrongBlock)
    }
  }

  openVerseBlock = () => {
    dispatch('SELECT_BIBLE_VERSE_BLOCK')
  }

  receiveVerseBlock = (data) => {
    dispatchConsole(`VERSE RECEIVED: ${JSON.stringify(data)}`)
  }

  openStrongBlock = (value) => {
    dispatch('SELECT_BIBLE_STRONG_BLOCK')
  }

  receiveStrongBlock = (data) => {
    dispatchConsole(`STRONG RECEIVED: ${JSON.stringify(data)}`)
  }
}

Quill.register({
  'modules/block-verse': ModuleBlockVerse
}, true)

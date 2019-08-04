import Quill from './quill.js'
import InlineTooltip from './InlineTooltip'
import { dispatch, dispatchConsole } from './dispatch'
const InlineVerseBlot = Quill.import('formats/inline-verse')
const InlineStrongBlot = Quill.import('formats/inline-strong')

const Module = Quill.import('core/module')

class ModuleInlineVerse extends Module {
  constructor (quill, options) {
    super(quill, options)

    this.quill = quill
    this.tooltip = new InlineTooltip(this.quill, this.quill.container)
  }

  openVerseLink = (value) => {
    const range = this.quill.getSelection(true)

    if (!range.length) {
      return
    }

    if (value) {
      // OPEN BIBLE SELECT THERE
      dispatch('SELECT_BIBLE_VERSE')
    } else {
      const [link, offset] = this.quill.scroll.descendant(
        InlineVerseBlot,
        range.index
      )

      this.quill.setSelection(range.index - offset, link.length())
      this.quill.format('inline-verse', false)
      this.tooltip.hide()
    }
  }

  receiveVerseLink = ({ title, verses }) => {
    const range = this.quill.getSelection(true)

    dispatchConsole(`Receive verses ${title}`)
    this.quill.format('inline-strong', false) // Disable inline-strong in case
    this.quill.format('inline-verse', {
      title,
      verses
    })
    this.quill.setSelection(range.index + 1, Quill.sources.SILENT)
  }

  openStrongLink = (value) => {
    const range = this.quill.getSelection(true)

    if (!range.length) {
      return
    }

    if (value) {
      // OPEN BIBLE SELECT THERE
      dispatch('SELECT_BIBLE_STRONG')
    } else {
      const [link, offset] = this.quill.scroll.descendant(
        InlineStrongBlot,
        range.index
      )

      this.quill.setSelection(range.index - offset, link.length())
      this.quill.format('inline-strong', false)
      this.tooltip.hide()
    }
  }

  receiveStrongLink = ({ title, code, book }) => {
    const range = this.quill.getSelection(true)

    dispatchConsole(`Receive strong ${title}`)
    this.quill.format('inline-verse', false) // Disable inline-verse in case
    this.quill.format('inline-strong', {
      title,
      code,
      book
    })
    this.quill.setSelection(range.index + 1, Quill.sources.SILENT)
  }
}

Quill.register({
  'modules/inline-verse': ModuleInlineVerse
}, true)

import Quill from './quill.js'
import InlineTooltip from './InlineTooltip'
import { dispatch, dispatchConsole } from './dispatch'

const InlineVerseBlot = Quill.import('formats/inline-verse')
const InlineStrongBlot = Quill.import('formats/inline-strong')

const Module = Quill.import('core/module')

class ModuleInlineVerse extends Module {
  constructor(quill, options) {
    super(quill, options)

    this.quill = quill
    this.tooltip = new InlineTooltip(this.quill, this.quill.container)
    this.range = null

    this.quill.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      if (type === Quill.events.SELECTION_CHANGE) {
        this.range = range
        dispatchConsole(`RANGE TO BE SAVED : ${JSON.stringify(this.range)}`)
      }
    })
  }

  // OBSOLETE
  openVerseLink = value => {
    const range = this.quill.getSelection(true)

    if (!range.length) {
      return
    }

    if (value) {
      // OPEN BIBLE SELECT THERE
      this.range = range
      dispatchConsole(`Range is ${JSON.stringify(this.range)}`)
      dispatch('SELECT_BIBLE_VERSE')
    } else {
      const [link, offset] = this.quill.scroll.descendant(InlineVerseBlot, range.index)

      this.quill.setSelection(range.index - offset, link.length())
      this.quill.format('inline-verse', false)
      this.tooltip.hide()
    }
  }

  receiveVerseLink = ({ title, verses }) => {
    this.quill.setSelection(this.range, Quill.sources.SILENT)

    // dispatchConsole(`Range: ${JSON.stringify(this.range)}`)

    if (this.range) {
      if (this.range.length) {
        this.quill.format('inline-strong', false) // Disable inline-strong in case
        this.quill.format('inline-verse', {
          title,
          verses
        })
        this.quill.setSelection(this.range.index + 1, Quill.sources.SILENT)
      } else {
        this.quill.insertText(this.range.index, title, 'inline-verse', {
          title,
          verses
        })
        this.quill.insertText(this.range.index, ' ')
      }
    }
  }

  // OBSOLETE
  openStrongLink = value => {
    const range = this.quill.getSelection(true)

    if (!range.length) {
      return
    }

    if (value) {
      // OPEN BIBLE SELECT THERE
      dispatch('SELECT_BIBLE_STRONG')
    } else {
      const [link, offset] = this.quill.scroll.descendant(InlineStrongBlot, range.index)

      this.quill.setSelection(range.index - offset, link.length())
      this.quill.format('inline-strong', false)
      this.tooltip.hide()
    }
  }

  receiveStrongLink = ({ title, codeStrong, book }) => {
    this.quill.setSelection(this.range, Quill.sources.SILENT)

    // dispatchConsole(`Receive strong ${title}`)

    if (this.range) {
      if (this.range.length) {
        this.quill.format('inline-verse', false) // Disable inline-verse in case
        this.quill.format('inline-strong', {
          title,
          codeStrong,
          book
        })
        this.quill.setSelection(this.range.index + 1, Quill.sources.SILENT)
      } else {
        this.quill.insertText(this.range.index, title, 'inline-strong', {
          title,
          codeStrong,
          book
        })
        this.quill.insertText(this.range.index, ' ')
      }
    }
  }
}

Quill.register(
  {
    'modules/inline-verse': ModuleInlineVerse
  },
  true
)

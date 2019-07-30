import Quill from '../quill.js'
import InlineTooltip from './InlineTooltip'
import { dispatch, dispatchConsole } from '../dispatch'
const InlineVerseBlot = Quill.import('formats/inline-verse')
const InlineStrongBlot = Quill.import('formats/inline-strong')

const Module = Quill.import('core/module')

class ModuleInlineVerse extends Module {
  static DEFAULTS = {
    buttonIcon: `<svg viewbox="0 0 18 18">
    <line class="ql-stroke" x1="7" x2="11" y1="7" y2="11"></line>
    <path class="ql-even ql-stroke" d="M8.9,4.577a3.476,3.476,0,0,1,.36,4.679A3.476,3.476,0,0,1,4.577,8.9C3.185,7.5,2.035,6.4,4.217,4.217S7.5,3.185,8.9,4.577Z"></path>
    <path class="ql-even ql-stroke" d="M13.423,9.1a3.476,3.476,0,0,0-4.679-.36,3.476,3.476,0,0,0,.36,4.679c1.392,1.392,2.5,2.542,4.679.36S14.815,10.5,13.423,9.1Z"></path>
  </svg>`
  }

  constructor (quill, options) {
    super(quill, options)

    this.quill = quill
    this.toolbar = quill.getModule('toolbar')
    this.tooltip = new InlineTooltip(this.quill, this.quill.container)

    if (typeof this.toolbar !== 'undefined') {
      this.toolbar.addHandler('inline-verse', this.openVerseLink)
      this.toolbar.addHandler('inline-strong', this.openStrongLink)
    }

    const verseLinkBtn = document.querySelector('.ql-inline-verse')
    if (verseLinkBtn) {
      verseLinkBtn.innerHTML = options.buttonIcon
    }

    const strongLinkBtn = document.querySelector('.ql-inline-strong')
    if (strongLinkBtn) {
      strongLinkBtn.innerHTML = options.buttonIcon
    }
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

  receiveStrongLink = ({ title, code }) => {
    const range = this.quill.getSelection(true)

    dispatchConsole(`Receive strong ${title}`)
    this.quill.format('inline-verse', false) // Disable inline-verse in case
    this.quill.format('inline-strong', {
      title,
      code
    })
    this.quill.setSelection(range.index + 1, Quill.sources.SILENT)
  }
}

Quill.register({
  'modules/inline-verse': ModuleInlineVerse
}, true)

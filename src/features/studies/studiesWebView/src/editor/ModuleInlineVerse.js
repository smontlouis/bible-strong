import Quill from '../quill.js'
import InlineTooltip from './InlineTooltip'
import { dispatch, dispatchConsole } from '../dispatch'
const InlineVerseBlot = Quill.import('formats/inline-verse')
const InlineStrongBlot = Quill.import('formats/inline-strong')

const Module = Quill.import('core/module')

class ModuleInlineVerse extends Module {
  static DEFAULTS = {
    buttonIcon: '<svg viewbox="0 0 18 18"><circle class="ql-fill" cx="7" cy="7" r="1"></circle><circle class="ql-fill" cx="11" cy="7" r="1"></circle><path class="ql-stroke" d="M7,10a2,2,0,0,0,4,0H7Z"></path><circle class="ql-stroke" cx="9" cy="9" r="6"></circle></svg>'
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
    const range = this.quill.getSelection()

    if (!range.length) {
      return
    }

    if (value) {
      // OPEN BIBLE SELECT THERE
      dispatch('SELECT_BIBLE_VERSE')
      this.range = range // Save section
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
    this.quill.setSelection(this.range)

    dispatchConsole(`Receive verses ${title}`)
    this.quill.format('inline-strong', false) // Disable inline-strong in case
    this.quill.format('inline-verse', {
      title,
      verses
    })
  }

  openStrongLink = (value) => {
    const range = this.quill.getSelection()

    if (!range.length) {
      return
    }

    if (value) {
      // OPEN BIBLE SELECT THERE
      dispatch('SELECT_BIBLE_STRONG')
      this.range = range // Save section
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
    this.quill.setSelection(this.range)

    dispatchConsole(`Receive strong ${title}`)
    this.quill.format('inline-verse', false) // Disable inline-verse in case
    this.quill.format('inline-strong', {
      title,
      code
    })
  }
}

Quill.register({
  'modules/inline-verse': ModuleInlineVerse
}, true)

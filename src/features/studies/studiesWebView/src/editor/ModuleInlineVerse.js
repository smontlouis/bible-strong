import Quill from '../quill.js'
const InlineVerseBlot = Quill.import('formats/inline-verse')
const Module = Quill.import('core/module')

class TooltipInlineVerse extends Module {
  static DEFAULTS = {
    buttonIcon: '<svg viewbox="0 0 18 18"><circle class="ql-fill" cx="7" cy="7" r="1"></circle><circle class="ql-fill" cx="11" cy="7" r="1"></circle><path class="ql-stroke" d="M7,10a2,2,0,0,0,4,0H7Z"></path><circle class="ql-stroke" cx="9" cy="9" r="6"></circle></svg>'
  }

  constructor (quill, options) {
    super(quill, options)

    this.quill = quill
    this.toolbar = quill.getModule('toolbar')
    if (typeof this.toolbar !== 'undefined') { this.toolbar.addHandler('inline-verse', this.openVerseLink) }

    const verseLinkBtn = document.querySelector('.ql-inline-verse')
    if (verseLinkBtn) {
      verseLinkBtn.innerHTML = options.buttonIcon
    }

    this.quill.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      if (type === Quill.events.SELECTION_CHANGE) {
        if (!range) return
        const [{ parent: link }] = this.quill.getLeaf(range.index)

        if (this.quill.getFormat(range)['inline-verse']) {
          const data = InlineVerseBlot.formats(link.domNode)
          console.log(data)
        }
      }
    })
  }

  openVerseLink = (value) => {
    const range = this.quill.getSelection()

    if (!range.length) {
      return
    }

    if (value) {
      this.quill.format('inline-verse', {
        title: 'Genèse 1:1-2,4',
        verses: ['1-1-1', '1-1-2', '1-1-4']
      })
    } else {
      const [{ parent: link }, offset] = this.quill.getLeaf(range.index)
      this.quill.setSelection(range.index - offset, link.length())
      this.quill.format('inline-verse', false)
    }
  }
}

Quill.register({
  'modules/inline-verse': TooltipInlineVerse
}, true)

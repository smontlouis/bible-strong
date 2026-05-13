import Quill from './quill'
import InlineTooltip from './InlineTooltip'

const InlineVerseBlot: any = Quill.import('formats/inline-verse')
const InlineStrongBlot: any = Quill.import('formats/inline-strong')

const Module: any = Quill.import('core/module')

class ModuleInlineVerse extends Module {
  quill: any
  tooltip: any
  range: any

  constructor(quill: any, options: any) {
    super(quill, options)

    this.quill = quill
    this.tooltip = new InlineTooltip(this.quill, this.quill.container)
    this.range = null

    this.quill.on(Quill.events.EDITOR_CHANGE, (type: string, range: any) => {
      if (type === Quill.events.SELECTION_CHANGE) {
        this.range = range
      }
    })
  }

  receiveVerseLink = ({ title, verses }: { title: string; verses: string[] }) => {
    this.quill.focus()
    this.quill.setSelection(this.range, Quill.sources.SILENT)

    if (this.range) {
      if (this.range.length) {
        this.quill.format('inline-strong', false) // Disable inline-strong in case
        this.quill.format('inline-verse', {
          title,
          verses,
        })
        this.quill.setSelection(this.range.index + this.range.length + 1, Quill.sources.SILENT)
      } else {
        this.quill.insertText(this.range.index, title, 'inline-verse', {
          title,
          verses,
        })
        this.quill.insertText(this.range.index, ' ', 'inline-verse', false)
      }
    }
  }

  receiveStrongLink = ({ title, codeStrong, book }: { title: string; codeStrong: string; book: string }) => {
    this.quill.focus()
    this.quill.setSelection(this.range, Quill.sources.SILENT)

    if (this.range) {
      if (this.range.length) {
        this.quill.format('inline-verse', false) // Disable inline-verse in case
        this.quill.format('inline-strong', {
          title,
          codeStrong,
          book,
        })
        this.quill.setSelection(this.range.index + this.range.length + 1, Quill.sources.SILENT)
      } else {
        this.quill.insertText(this.range.index, title, 'inline-strong', {
          title,
          codeStrong,
          book,
        })
        this.quill.insertText(this.range.index, ' ', 'inline-strong', false)
      }
    }
  }
}

Quill.register(
  {
    'modules/inline-verse': ModuleInlineVerse,
  },
  true
)

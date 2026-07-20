import Quill from './quill'
import InlineTooltip from './InlineTooltip'
import type {
  InlineStrongPayload,
  InlineVersePayload,
  QuillInstance,
  QuillModuleConstructor,
  QuillRange,
} from './quill-types'

const Module = Quill.import('core/module') as QuillModuleConstructor

class ModuleInlineVerse extends Module {
  quill: QuillInstance
  tooltip: InlineTooltip
  range: QuillRange | null

  constructor(quill: QuillInstance, options: unknown) {
    super(quill, options)

    this.quill = quill
    this.tooltip = new InlineTooltip(this.quill, this.quill.container)
    this.range = null

    this.quill.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      if (type === Quill.events.SELECTION_CHANGE) {
        const nextRange = range as QuillRange | null
        if (nextRange) {
          this.range = nextRange
        }
      }
    })
  }

  getInsertionRange = () => {
    return (
      this.range ??
      this.quill.selection.savedRange ?? { index: this.quill.getLength() - 1, length: 0 }
    )
  }

  receiveVerseLink = ({ title, verses, version }: InlineVersePayload) => {
    const range = this.getInsertionRange()
    this.quill.focus()
    this.quill.setSelection(range, Quill.sources.SILENT)

    if (range.length) {
      this.quill.format('inline-strong', false) // Disable inline-strong in case
      this.quill.format('inline-verse', {
        title,
        verses,
        version,
      })
      this.quill.setSelection(range.index + range.length + 1, Quill.sources.SILENT)
    } else {
      this.quill.insertText(range.index, title, 'inline-verse', {
        title,
        verses,
        version,
      })
      this.quill.insertText(range.index, ' ', 'inline-verse', false)
    }
  }

  receiveStrongLink = ({ title, codeStrong, book }: InlineStrongPayload) => {
    const range = this.getInsertionRange()
    this.quill.focus()
    this.quill.setSelection(range, Quill.sources.SILENT)

    if (range.length) {
      this.quill.format('inline-verse', false) // Disable inline-verse in case
      this.quill.format('inline-strong', {
        title,
        codeStrong,
        book,
      })
      this.quill.setSelection(range.index + range.length + 1, Quill.sources.SILENT)
    } else {
      this.quill.insertText(range.index, title, 'inline-strong', {
        title,
        codeStrong,
        book,
      })
      this.quill.insertText(range.index, ' ', 'inline-strong', false)
    }
  }
}

Quill.register(
  {
    'modules/inline-verse': ModuleInlineVerse,
  },
  true
)

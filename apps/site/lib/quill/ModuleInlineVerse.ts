import { Quill, QuillOptions, Range } from 'react-quill'
import InlineTooltip from './InlineTooltip'

const Module = Quill.import('core/module')

class ModuleInlineVerse extends Module {
  constructor(quill: typeof Quill, options: QuillOptions) {
    super(quill, options)

    this.quill = quill
    this.tooltip = new InlineTooltip(this.quill, this.quill.container)
    this.range = null

    this.quill.on(
      'selection-change',
      (range: Range, oldRange: Range, source: string) => {
        if (range === null && oldRange !== null) {
          this.range = oldRange
        } else {
          this.range = range
        }
      }
    )
  }

  receiveVerseLink = ({
    title,
    verses,
  }: {
    title: string
    verses: string[]
  }) => {
    this.quill.setSelection(this.range, 'silent')

    if (this.range) {
      if (this.range.length) {
        this.quill.format('inline-strong', false) // Disable inline-strong in case
        this.quill.format('inline-verse', {
          title,
          verses,
        })
        this.quill.setSelection(
          this.range.index + this.range.length + 1,
          'silent'
        )
      } else {
        this.quill.insertText(this.range.index, title, 'inline-verse', {
          title,
          verses,
        })
        this.quill.insertText(this.range.index, ' ', 'inline-verse', false)

        this.quill.setSelection(
          this.range.index + this.range.length + 1,
          'silent'
        )
      }
    }
  }

  receiveStrongLink = ({
    title,
    codeStrong,
    book,
  }: {
    title: string
    codeStrong: string
    book: string
  }) => {
    this.quill.focus()
    this.quill.setSelection(this.range, 'silent')

    if (this.range) {
      if (this.range.length) {
        this.quill.format('inline-verse', false) // Disable inline-verse in case
        this.quill.format('inline-strong', {
          title,
          codeStrong,
          book,
        })

        this.quill.setSelection(
          this.range.index + this.range.length + 1,
          'silent'
        )
      } else {
        this.quill.insertText(this.range.index, title, 'inline-strong', {
          title,
          codeStrong,
          book,
        })
        this.quill.insertText(this.range.index, ' ', 'inline-strong', false)
        this.quill.setSelection(
          this.range.index + this.range.length + 2 + title.length,
          'silent'
        )
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

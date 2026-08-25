import { Quill, QuillOptions } from 'react-quill'

const Module = Quill.import('core/module')

class ModuleBlockVerse extends Module {
  constructor(quill: typeof Quill, options: QuillOptions) {
    super(quill, options)
    this.quill = quill
  }

  openVerseBlock = () => {}

  receiveVerseBlock = (data: {
    title: string
    content: string
    version: string
    verses: string[]
  }) => {
    console.log(`VERSE RECEIVED: ${JSON.stringify(data)}`)

    const { title, content, version, verses } = data

    const range = this.quill.selection.savedRange
    if (!range || range.length != 0) return
    const cursorPosition = range.index

    this.quill.insertEmbed(
      cursorPosition,
      'block-verse',
      { title, content, version, verses },
      'api'
    )
    this.quill.insertText(cursorPosition + 1, ' ', 'api')
    // this.quill.setSelection(cursorPosition + 2, Quill.sources.API)
  }

  receiveStrongBlock = (data: {
    title: string
    codeStrong: string
    strongType: string
    phonetique: string
    definition: string
    translatedBy: string
    book: string
    original: string
  }) => {
    this.quill.focus()

    const {
      title,
      codeStrong,
      phonetique,
      // strongType,
      // definition,
      // translatedBy,
      book,
      original,
    } = data

    const range = this.quill.selection.savedRange
    if (!range || range.length != 0) return
    const cursorPosition = range.index

    this.quill.insertEmbed(
      cursorPosition,
      'block-strong',
      { title, codeStrong, phonetique, book, original },
      'api'
    )
    this.quill.insertText(cursorPosition + 1, ' ', 'api')
    this.quill.setSelection(cursorPosition + 2, 'api')
  }
}

Quill.register(
  {
    'modules/block-verse': ModuleBlockVerse,
  },
  true
)

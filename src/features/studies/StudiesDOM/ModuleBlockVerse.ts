import Quill from './quill'
import { dispatch } from './dispatch'
import type {
  QuillInstance,
  QuillModuleConstructor,
  QuillRange,
  StrongBlockPayload,
  VerseBlockPayload,
} from './quill-types'

const Module = Quill.import('core/module') as QuillModuleConstructor

class ModuleBlockVerse extends Module {
  quill: QuillInstance
  range: QuillRange | null

  constructor(quill: QuillInstance, options: unknown) {
    super(quill, options)
    this.quill = quill
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

  openVerseBlock = () => {
    dispatch('SELECT_BIBLE_VERSE_BLOCK')
  }

  getInsertionRange = () => {
    return (
      this.range ??
      this.quill.selection.savedRange ?? { index: this.quill.getLength() - 1, length: 0 }
    )
  }

  receiveVerseBlock = (data: VerseBlockPayload) => {
    const range = this.getInsertionRange()
    this.quill.focus()
    console.log(`[Studies] VERSE RECEIVED: ${JSON.stringify(data)}`)

    const { title, content, version, verses } = data

    if (range.length !== 0) return
    const cursorPosition = range.index

    this.quill.insertEmbed(
      cursorPosition,
      'block-verse',
      { title, content, version, verses },
      Quill.sources.API
    )
    this.quill.insertText(cursorPosition + 1, ' ', Quill.sources.API)
    this.quill.setSelection(cursorPosition + 2, Quill.sources.API)
  }

  openStrongBlock = (_value?: unknown) => {
    dispatch('SELECT_BIBLE_STRONG_BLOCK')
  }

  receiveStrongBlock = (data: StrongBlockPayload) => {
    const range = this.getInsertionRange()
    this.quill.focus()
    console.log(`[Studies] STRONG RECEIVED: ${JSON.stringify(data)}`)

    const { title, codeStrong, phonetique, book, original } = data

    if (range.length !== 0) return
    const cursorPosition = range.index

    this.quill.insertEmbed(
      cursorPosition,
      'block-strong',
      { title, codeStrong, phonetique, book, original },
      Quill.sources.API
    )
    this.quill.insertText(cursorPosition + 1, ' ', Quill.sources.API)
    this.quill.setSelection(cursorPosition + 2, Quill.sources.API)
  }
}

Quill.register(
  {
    'modules/block-verse': ModuleBlockVerse,
  },
  true
)

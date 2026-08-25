import type { StudyEntityEmbedPayload } from '../studyEntityEmbeds'
import Quill from './quill'
import type { QuillInstance, QuillModuleConstructor, QuillRange } from './quill-types'

const Module = Quill.import('core/module') as QuillModuleConstructor

class ModuleEntity extends Module {
  quill: QuillInstance
  range: QuillRange | null

  constructor(quill: QuillInstance, options: unknown) {
    super(quill, options)
    this.quill = quill
    this.range = null

    this.quill.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      if (type === Quill.events.SELECTION_CHANGE && range) {
        this.range = range as QuillRange
      }
    })
  }

  getInsertionRange = () =>
    this.range ??
    this.quill.selection.savedRange ?? { index: this.quill.getLength() - 1, length: 0 }

  receiveEntityLink = (data: StudyEntityEmbedPayload) => {
    const range = this.getInsertionRange()
    this.quill.focus()
    this.quill.setSelection(range, Quill.sources.SILENT)

    if (range.length) {
      this.quill.format('inline-verse', false, Quill.sources.USER)
      this.quill.format('inline-strong', false, Quill.sources.USER)
      this.quill.format('inline-entity', data, Quill.sources.USER)
      this.quill.setSelection(range.index + range.length, Quill.sources.SILENT)
      return
    }

    const label = data.display.title
    this.quill.insertText(range.index, label, 'inline-entity', data, Quill.sources.USER)
    this.quill.insertText(
      range.index + label.length,
      ' ',
      'inline-entity',
      false,
      Quill.sources.USER
    )
    this.quill.setSelection(range.index + label.length + 1, Quill.sources.SILENT)
  }

  receiveEntityBlock = (data: StudyEntityEmbedPayload) => {
    const range = this.getInsertionRange()
    this.quill.focus()
    if (range.length) return
    this.quill.insertEmbed(range.index, 'block-entity', data, Quill.sources.USER)
    this.quill.insertText(range.index + 1, ' ', Quill.sources.USER)
    this.quill.setSelection(range.index + 2, Quill.sources.SILENT)
  }
}

Quill.register({ 'modules/entity': ModuleEntity }, true)

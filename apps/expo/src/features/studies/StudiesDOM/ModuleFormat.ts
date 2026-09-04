import Quill from './quill'
import { dispatch } from './dispatch'
import type { QuillInstance, QuillModuleConstructor, QuillRange } from './quill-types'

const Module = Quill.import('core/module') as QuillModuleConstructor

interface FormatModuleContext {
  quill: QuillInstance
}

class ModuleFormat extends Module {
  quill: QuillInstance

  constructor(quill: QuillInstance, options: unknown) {
    super(quill, options)
    this.quill = quill

    this.quill.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      if (type === Quill.events.SELECTION_CHANGE) {
        this.update(range as QuillRange | null)
      }
    })
    this.quill.on(Quill.events.SCROLL_OPTIMIZE, () => {
      const [range] = this.quill.selection.getRange() // quill.getSelection triggers update
      this.update(range)
    })
  }

  // This function is useful to toggle active class
  update(range: QuillRange | null) {
    // Get what format are applied on given range
    const formats = range == null ? {} : this.quill.getFormat(range)
    dispatch('ACTIVE_FORMATS', JSON.stringify(formats))
  }

  format(name: string, value: unknown = true) {
    this.quill.format(name, value, Quill.sources.USER)
    const range = this.quill.getSelection(true)
    this.update(range)
    this.quill.focus()
  }

  static DEFAULTS = {
    container: null as HTMLElement | null,
    handlers: {
      indent(this: FormatModuleContext, value: string) {
        const range = this.quill.getSelection()
        const formats = this.quill.getFormat(range)
        const indent = parseInt(String(formats.indent || 0), 10)
        if (value === '+1' || value === '-1') {
          let modifier = value === '+1' ? 1 : -1
          if (formats.direction === 'rtl') modifier *= -1
          this.quill.format('indent', indent + modifier, Quill.sources.USER)
        }
      },
      list(this: FormatModuleContext, value: string) {
        const range = this.quill.getSelection()
        const formats = this.quill.getFormat(range)
        if (value === 'check') {
          if (formats.list === 'checked' || formats.list === 'unchecked') {
            this.quill.format('list', false, Quill.sources.USER)
          } else {
            this.quill.format('list', 'unchecked', Quill.sources.USER)
          }
        } else {
          this.quill.format('list', value, Quill.sources.USER)
        }
      },
    },
  }
}

Quill.register(
  {
    'modules/format': ModuleFormat,
  },
  true
)

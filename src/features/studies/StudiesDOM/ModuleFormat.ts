import Quill from './quill'
import { dispatch } from './dispatch'

const Module: any = Quill.import('core/module')

class ModuleFormat extends Module {
  quill: any

  constructor(quill: any, options: any) {
    super(quill, options)

    this.quill.on(Quill.events.EDITOR_CHANGE, (type: string, range: any) => {
      if (type === Quill.events.SELECTION_CHANGE) {
        this.update(range)
      }
    })
    this.quill.on(Quill.events.SCROLL_OPTIMIZE, () => {
      const [range] = this.quill.selection.getRange() // quill.getSelection triggers update
      this.update(range)
    })
  }

  // This function is useful to toggle active class
  update(range: any) {
    // Get what format are applied on given range
    const formats = range == null ? {} : this.quill.getFormat(range)
    dispatch('ACTIVE_FORMATS', JSON.stringify(formats))
  }

  format(name: string, value: any = true) {
    this.quill.format(name, value, Quill.sources.USER)
    const range = this.quill.getSelection(true)
    this.update(range)
    this.quill.focus()
  }

  static DEFAULTS = {
    container: null as any,
    handlers: {
      indent(this: any, value: string) {
        const range = this.quill.getSelection()
        const formats = this.quill.getFormat(range)
        const indent = parseInt(formats.indent || 0, 10)
        if (value === '+1' || value === '-1') {
          let modifier = value === '+1' ? 1 : -1
          if (formats.direction === 'rtl') modifier *= -1
          this.quill.format('indent', indent + modifier, Quill.sources.USER)
        }
      },
      list(this: any, value: string) {
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

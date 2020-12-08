import Quill from './quill.js'
import { dispatch, dispatchConsole } from './dispatch'

const Tooltip = Quill.import('ui/tooltip')
const InlineVerseBlot = Quill.import('formats/inline-verse')
const InlineStrongBlot = Quill.import('formats/inline-strong')

class InlineTooltip extends Tooltip {
  constructor (quill, boundsContainer) {
    super(quill, boundsContainer)
    this.title = this.root.querySelector('div.ql-preview')
    this.listen()
  }

  listen = () => {
    this.root.querySelector('a.ql-remove').addEventListener('click', event => {
      this.quill.setSelection(...this.linkRange)

      this.quill.format('inline-verse', false)
      this.quill.format('inline-strong', false)

      event.preventDefault()
      this.hide()
    })

    this.root.querySelector('a.ql-action').addEventListener('click', event => {
      this.quill.focus()

      this.quill.setSelection(...this.linkRange)

      if (this.type === 'inline-verse') {
        dispatch('SELECT_BIBLE_VERSE')
      } else {
        dispatch('SELECT_BIBLE_STRONG')
      }

    })

    this.quill.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      const isReadOnly = this.quill.container.classList.contains('ql-disabled')

      if (type === Quill.events.SELECTION_CHANGE) {
        if (!range) return

        if (isReadOnly) {
          return
        }

        const [linkVerse, offsetVerse] = this.quill.scroll.descendant(
          InlineVerseBlot,
          range.index
        )

        const [linkStrong, offsetStrong] = this.quill.scroll.descendant(
          InlineStrongBlot,
          range.index
        )

        // IF VERSE
        if (this.quill.getFormat(range)['inline-verse'] && linkVerse) {
          this.linkRange = [range.index - offsetVerse, linkVerse.length()]
          this.type = 'inline-verse'
          const data = InlineVerseBlot.formats(linkVerse.domNode)
          this.title.textContent = data.title

          this.show()
          this.position(this.quill.getBounds(range))

        // IF STRONG
        } else if (this.quill.getFormat(range)['inline-strong'] && linkStrong) {
          this.linkRange = [range.index - offsetStrong, linkStrong.length()]
          this.type = 'inline-strong'
          const data = InlineStrongBlot.formats(linkStrong.domNode)
          this.title.textContent = data.title

          this.show()
          this.position(this.quill.getBounds(range))
        } else {
          this.hide()
        }
      }
    })
  }

  static TEMPLATE = [
    '<div class="ql-preview"></div>',
    '<a class="ql-action"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></a>',
    '<a class="ql-remove"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(194,40,57)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></a>'
  ].join('');
}

export default InlineTooltip

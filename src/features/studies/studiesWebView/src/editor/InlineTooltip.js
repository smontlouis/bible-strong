import Quill from '../quill.js'
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

    this.quill.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      if (type === Quill.events.SELECTION_CHANGE) {
        if (!range) return

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
          const data = InlineVerseBlot.formats(linkVerse.domNode)
          this.title.textContent = data.title

          this.show()
          this.position(this.quill.getBounds(range))

        // IF STRONG
        } else if (this.quill.getFormat(range)['inline-strong'] && linkStrong) {
          this.linkRange = [range.index - offsetStrong, linkStrong.length()]
          const data = InlineVerseBlot.formats(linkStrong.domNode)
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
    '<a class="ql-action"></a>',
    '<a class="ql-remove"></a>'
  ].join('');
}

export default InlineTooltip

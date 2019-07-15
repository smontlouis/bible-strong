import Quill from '../quill.js'
const Inline = Quill.import('blots/inline')

class InlineStrong extends Inline {
  static blotName = 'inline-strong'
  static tagName = 'a'

  static create (value) {
    let node = super.create()
    node.setAttribute('data-verses', value)
    node.classList.add('inline-verse')
    return node
  }

  static formats (node) {
    return node.getAttribute('data-verses')
  }
}

Quill.register(InlineStrong)

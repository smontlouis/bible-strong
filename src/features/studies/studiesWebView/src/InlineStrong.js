import Quill from './quill.js'
import { dispatch, dispatchConsole } from './dispatch'
const Inline = Quill.import('blots/inline')

class InlineStrong extends Inline {
  static blotName = 'inline-strong'
  static tagName = 'a'
  static className = 'inline-strong'

  static create ({ title, code, book }) {
    let node = super.create()
    node.setAttribute('data-title', title)
    node.setAttribute('data-code', code)
    node.setAttribute('data-book', book)

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor').classList.contains('ql-disabled')
      if (isReadOnly) {
        dispatchConsole(`${code} ${book}`)
        dispatch('VIEW_BIBLE_STRONG', {
          reference: code,
          book
        })
      }
    })
    return node
  }

  static formats (domNode) {
    return {
      title: domNode.getAttribute('data-title'),
      code: domNode.getAttribute('data-code'),
      book: domNode.getAttribute('data-book')
    }
  }
}

Quill.register(InlineStrong)

export default InlineStrong

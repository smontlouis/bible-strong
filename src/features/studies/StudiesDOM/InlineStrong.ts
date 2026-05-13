import Quill from './quill'
import { dispatch } from './dispatch'
import type { InlineStrongPayload, QuillBlotConstructor } from './quill-types'

const Inline = Quill.import('blots/inline') as QuillBlotConstructor

class InlineStrong extends Inline {
  static blotName = 'inline-strong'
  static tagName = 'a'
  static className = 'inline-strong'

  static create({ title, codeStrong, book }: InlineStrongPayload) {
    const node = super.create()
    node.setAttribute('data-title', title)
    node.setAttribute('data-codeStrong', codeStrong)
    node.setAttribute('data-book', book)

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor')?.classList.contains('ql-disabled')
      if (isReadOnly) {
        console.log(`[Studies] ${codeStrong} ${book}`)
        dispatch('VIEW_BIBLE_STRONG', {
          reference: codeStrong,
          book,
        })
      }
    })

    return node
  }

  static formats(domNode: HTMLElement) {
    return {
      title: domNode.getAttribute('data-title'),
      codeStrong: domNode.getAttribute('data-codeStrong'),
      book: domNode.getAttribute('data-book'),
    }
  }
}

Quill.register(InlineStrong)

export default InlineStrong

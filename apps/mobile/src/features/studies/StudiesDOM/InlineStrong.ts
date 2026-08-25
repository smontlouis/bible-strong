import Quill from './quill'
import { dispatch } from './dispatch'
import type { InlineStrongPayload, QuillBlotConstructor } from './quill-types'
import { getPersistedStudyStrongReference } from '../strongStudyReference'

const Inline = Quill.import('blots/inline') as QuillBlotConstructor

class InlineStrong extends Inline {
  static blotName = 'inline-strong'
  static tagName = 'a'
  static className = 'inline-strong'

  static create(data: InlineStrongPayload) {
    const node = super.create()
    const { title, book } = data
    const codeStrong = getPersistedStudyStrongReference(data)
    node.setAttribute('data-title', title)
    if (codeStrong) node.setAttribute('data-codeStrong', codeStrong)
    node.setAttribute('data-book', String(book))

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor')?.classList.contains('ql-disabled')
      if (isReadOnly) {
        console.log(`[Studies] ${codeStrong} ${book}`)
        if (codeStrong) {
          dispatch('VIEW_BIBLE_STRONG', {
            reference: codeStrong,
            book,
          })
        }
      }
    })

    return node
  }

  static formats(domNode: HTMLElement) {
    return {
      title: domNode.getAttribute('data-title'),
      codeStrong: getPersistedStudyStrongReference({
        codeStrong: domNode.getAttribute('data-codeStrong'),
        code: domNode.getAttribute('data-code'),
      }),
      book: domNode.getAttribute('data-book'),
    }
  }
}

Quill.register(InlineStrong)

export default InlineStrong

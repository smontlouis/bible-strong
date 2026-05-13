import Quill from './quill'
import { dispatch } from './dispatch'
import type { InlineVersePayload, QuillBlotConstructor } from './quill-types'

const Inline = Quill.import('blots/inline') as QuillBlotConstructor

class InlineVerse extends Inline {
  static blotName = 'inline-verse'

  static tagName = 'a'

  static className = 'inline-verse'

  static create({ title, verses }: InlineVersePayload) {
    const node = super.create()
    node.setAttribute('data-title', title)
    node.setAttribute('data-verses', JSON.stringify(verses))

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor')?.classList.contains('ql-disabled')
      if (isReadOnly) {
        dispatch('VIEW_BIBLE_VERSE', {
          arrayVerses: verses,
        })
      }
    })

    return node
  }

  static formats(domNode: HTMLElement) {
    return {
      title: domNode.getAttribute('data-title'),
      verses: JSON.parse(domNode.getAttribute('data-verses') || '[]') as string[],
    }
  }
}

Quill.register(InlineVerse)

export default InlineVerse

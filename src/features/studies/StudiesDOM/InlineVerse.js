import Quill from './quill.js'
import { dispatch } from './dispatch'

const Inline = Quill.import('blots/inline')

class InlineVerse extends Inline {
  static blotName = 'inline-verse'

  static tagName = 'a'

  static className = 'inline-verse'

  static create({ title, verses }) {
    const node = super.create()
    node.setAttribute('data-title', title)
    node.setAttribute('data-verses', JSON.stringify(verses))

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor').classList.contains('ql-disabled')
      if (isReadOnly) {
        dispatch('VIEW_BIBLE_VERSE', {
          arrayVerses: verses,
        })
      }
    })

    return node
  }

  static formats(domNode) {
    return {
      title: domNode.getAttribute('data-title'),
      verses: JSON.parse(domNode.getAttribute('data-verses')),
    }
  }
}

Quill.register(InlineVerse)

export default InlineVerse

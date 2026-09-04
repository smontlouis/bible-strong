import { Quill } from 'react-quill'

const Inline = Quill.import('blots/inline')

class InlineVerse extends Inline {
  static blotName = 'inline-verse'

  static tagName = 'a'

  static className = 'inline-verse'

  static create({ title, verses }: { title: string; verses: string[] }) {
    const node = super.create()
    node.setAttribute('data-title', title)
    node.setAttribute('data-verses', JSON.stringify(verses))

    node.addEventListener('click', () => {
      const isReadOnly = document
        .querySelector('#editor')
        ?.classList.contains('ql-disabled')
      if (isReadOnly) {
        const [book, chapter, verse] = verses[0].split('-')
        console.log(book, chapter, verse)
      }
    })

    return node
  }

  static formats(domNode: HTMLElement) {
    return {
      title: domNode.getAttribute('data-title'),
      verses: JSON.parse(domNode.getAttribute('data-verses') || ''),
    }
  }
}

Quill.register(InlineVerse)

export default InlineVerse

import { Quill } from 'react-quill'
const Inline = Quill.import('blots/inline')

class InlineStrong extends Inline {
  static blotName = 'inline-strong'
  static tagName = 'a'
  static className = 'inline-strong'

  static create({
    title,
    codeStrong,
    book,
  }: {
    title: string
    codeStrong: string
    book: string
  }) {
    let node = super.create()
    node.setAttribute('data-title', title)
    node.setAttribute('data-codeStrong', codeStrong)
    node.setAttribute('data-book', book)

    node.addEventListener('click', () => {
      const isReadOnly = document
        .querySelector('#editor')
        ?.classList.contains('ql-disabled')
      if (isReadOnly) {
        console.log({ title, codeStrong, book })
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

import React from 'react'
import ReactDOM from 'react-dom'
import Verse from './Verse'
import { dispatch } from './dispatch'

import Quill from './quill.js'
const Block = Quill.import('blots/block/embed')

class VerseBlock extends Block {
  static blotName = 'block-verse'
  static tagName = 'div'
  static className = 'block-verse'

  static create (data) {
    let node = super.create(data)
    const { title, content, version, verses } = data
    node.setAttribute('data', JSON.stringify(data))

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor').classList.contains('ql-disabled')
      if (isReadOnly) {
        const [book, chapter, verse] = verses[0].split('-')

        dispatch('VIEW_BIBLE_VERSE', {
          isReadOnly: true,
          arrayVerses: verses,
          book,
          chapter,
          verse
        })
      }
    })

    ReactDOM.render(
      <Verse {...{ title, content, version, verses }}
      />, node
    )

    return node
  }

  static formats (domNode) {
    const data = domNode.getAttribute('data')
    return JSON.parse(data)
  }

  static value (domNode) {
    const data = domNode.getAttribute('data')
    return JSON.parse(data)
  }
}

Quill.register(VerseBlock)

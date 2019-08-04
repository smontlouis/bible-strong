import React from 'react'
import ReactDOM from 'react-dom'
import Strong from './Strong'
import { dispatch, dispatchConsole } from './dispatch'

import Quill from './quill.js'
const Block = Quill.import('blots/block/embed')

class StrongBlock extends Block {
  static blotName = 'block-strong'
  static tagName = 'div'
  static className = 'block-strong'

  static create (data) {
    let node = super.create(data)
    const { title, code, strongType, phonetique, definition, translatedBy, book } = data
    node.setAttribute('data', JSON.stringify(data))

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

    ReactDOM.render(
      <Strong {...{ title, code, strongType, phonetique, definition, translatedBy }} />, node
    )

    return node
  }

  static formats (domNode) {
    const data = domNode.getAttribute('data')
    return JSON.parse(data)
  }

  static value (domNode) {
    const data = domNode.getAttribute('data')
    console.log(data)
    return JSON.parse(data)
  }
}

Quill.register(StrongBlock)

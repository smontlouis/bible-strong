import React from 'react'
import ReactDOM from 'react-dom'
import Verse from './Verse'

import Quill from '../quill.js'
const BlockEmbed = Quill.import('blots/block/embed')

class VerseBlock extends BlockEmbed {
  static blotName = 'block-verse'
  static tagName = 'div'
  static className = 'block-verse'

  static create (data) {
    let node = super.create(data)
    node.setAttribute('contenteditable', false)
    const { title, content, version, verses } = data
    node.setAttribute('data', JSON.stringify(data))

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

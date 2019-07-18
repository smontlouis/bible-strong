import React from 'react'
import ReactDOM from 'react-dom'
import Strong from './Strong'

import Quill from '../quill.js'
const BlockEmbed = Quill.import('blots/block/embed')

class StrongBlock extends BlockEmbed {
  static blotName = 'block-strong'
  static tagName = 'div'
  static className = 'block-strong'

  static create (data) {
    let node = super.create(data)
    node.setAttribute('contenteditable', false)
    const { title, code, strongType, phonetique, definition, translatedBy } = data
    node.setAttribute('data', JSON.stringify(data))

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

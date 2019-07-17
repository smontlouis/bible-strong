import React from 'react'
import ReactDOM from 'react-dom'
import Verse from './Verse'

import Quill from '../quill.js'
const BlockEmbed = Quill.import('blots/block/embed')

class StrongBlock extends BlockEmbed {
  static blotName = 'block-strong'
  static tagName = 'div'
  static className = 'block-strong'

  static create (data) {
    let node = super.create(data)
    node.setAttribute('contenteditable', false)

    ReactDOM.render(
      <Verse
        title={data.title}
      />, node
    )

    return node
  }

  static formats (domNode) {
    return {
      title: domNode.getAttribute('data-title')
    }
  }

  static value (domNode) {
    return JSON.parse(domNode.getAttribute('data-title'))
  }
}

Quill.register(StrongBlock)

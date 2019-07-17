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

    ReactDOM.render(
      <Verse
        title={data.title}
        verses={data.verses}
        content={data.content}
      />, node
    )

    return node
  }

  static formats (domNode) {
    return {
      title: domNode.getAttribute('data-title'),
      verses: JSON.parse(domNode.getAttribute('data-verses'))
    }
  }

  static value (domNode) {
    return JSON.parse(domNode.getAttribute('data-verses'))
  }
}

Quill.register(VerseBlock)

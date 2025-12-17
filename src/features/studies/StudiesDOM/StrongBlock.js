import React from 'react'
import ReactDOMServer from 'react-dom/server'
import Strong from './Strong'
import { dispatch } from './dispatch'

import Quill from './quill.js'

const Embed = Quill.import('blots/embed')

class StrongBlock extends Embed {
  static blotName = 'block-strong'

  static tagName = 'div'

  static className = 'block-strong'

  static create(data) {
    const node = super.create(data)
    const { title, codeStrong, strongType, phonetique, definition, translatedBy, book, original } =
      data
    node.innerHTML = ReactDOMServer.renderToString(
      <Strong
        {...{
          title,
          codeStrong,
          strongType,
          phonetique,
          definition,
          translatedBy,
          original,
        }}
      />
    )
    node.setAttribute('data', JSON.stringify(data))
    node.setAttribute('spellcheck', 'false')
    node.setAttribute('autocomplete', 'off')
    node.setAttribute('autocorrect', 'off')
    node.setAttribute('autocapitalize', 'off')

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor').classList.contains('ql-disabled')
      if (isReadOnly) {
        console.log(`${codeStrong} ${book}`)
        dispatch('VIEW_BIBLE_STRONG', {
          reference: codeStrong,
          book,
        })
      }
    })

    node.querySelector('.block-delete').addEventListener('click', () => {
      node.remove()
    })

    return node
  }

  static formats(domNode) {
    const data = domNode.getAttribute('data')
    return JSON.parse(data)
  }

  static value(domNode) {
    const data = domNode.getAttribute('data')
    return JSON.parse(data)
  }

  /**
   * Redefine the `update` method to handle the `childList` case.
   * This is necessary to correctly handle "backspace" on Android using Gboard.
   * It behaves differently than other cases and we need to handle the node
   * removal instead of the `characterData`.
   */
  update(mutations, context) {
    // `childList` mutations are not handled on Quill
    // see `update` implementation on:
    // https://github.com/quilljs/quill/blob/master/blots/embed.js

    mutations.forEach(mutation => {
      if (mutation.type != 'childList') return
      if (mutation.removedNodes.length == 0) return

      setTimeout(() => this._remove(), 0)
    })

    const unhandledMutations = mutations.filter(m => m.type != 'childList')
    super.update(unhandledMutations, context)
  }

  _remove() {
    // NOTE: call this function as:
    // setTimeout(() => this._remove(), 0);
    // otherwise you'll get the error: "The given range isn't in document."
    const cursorPosition = quill.getSelection().index - 1

    // see `remove` implementation on:
    // https://github.com/quilljs/parchment/blob/master/src/blot/abstract/shadow.ts
    this.remove()

    // schedule cursor positioning after quill is done with whatever has scheduled
    setTimeout(() => quill.setSelection(cursorPosition, Quill.sources.API), 0)
  }
}

Quill.register(StrongBlock)

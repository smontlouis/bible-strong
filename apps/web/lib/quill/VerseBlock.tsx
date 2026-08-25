import React from 'react'
import ReactDOMServer from 'react-dom/server'
import Verse from './Verse'

import { Quill } from 'react-quill'

const Embed = Quill.import('blots/embed')

class VerseBlock extends Embed {
  static blotName = 'block-verse'

  static tagName = 'div'

  static className = 'block-verse'

  static create(data: any) {
    const node = super.create(data)
    const { title, content, version, verses } = data
    node.innerHTML = ReactDOMServer.renderToString(
      <Verse {...{ title, content, version, verses }} />
    )
    node.setAttribute('data', JSON.stringify(data))
    node.setAttribute('spellcheck', 'false')
    node.setAttribute('autocomplete', 'off')
    node.setAttribute('autocorrect', 'off')
    node.setAttribute('autocapitalize', 'off')

    node.addEventListener('click', () => {
      const isReadOnly = document
        .querySelector('#editor')
        ?.classList.contains('ql-disabled')
      if (isReadOnly) {
        const [book, chapter, verse] = verses[0].split('-')

        console.log('VIEW_BIBLE_VERSE', {
          isReadOnly: true,
          arrayVerses: verses,
          book,
          chapter,
          verse,
        })
      }
    })

    node.querySelector('.block-delete').addEventListener('click', () => {
      node.remove()
    })

    return node
  }

  static formats(domNode: HTMLElement) {
    const data = domNode.getAttribute('data')
    return JSON.parse(data || '')
  }

  static value(domNode: HTMLElement) {
    const data = domNode.getAttribute('data')
    return JSON.parse(data || '')
  }

  /**
   * Redefine the `update` method to handle the `childList` case.
   * This is necessary to correctly handle "backspace" on Android using Gboard.
   * It behaves differently than other cases and we need to handle the node
   * removal instead of the `characterData`.
   */
  update(mutations: any, context: any) {
    // `childList` mutations are not handled on Quill
    // see `update` implementation on:
    // https://github.com/quilljs/quill/blob/master/blots/embed.js

    mutations.forEach((mutation: any) => {
      if (mutation.type != 'childList') return
      if (mutation.removedNodes.length == 0) return

      setTimeout(() => this._remove(), 0)
    })

    const unhandledMutations = mutations.filter(
      (m: any) => m.type != 'childList'
    )
    super.update(unhandledMutations, context)
  }

  _remove() {
    // NOTE: call this function as:
    // setTimeout(() => this._remove(), 0);
    // otherwise you'll get the error: "The given range isn't in document."
    const cursorPosition = this.quill.getSelection().index - 1

    // see `remove` implementation on:
    // https://github.com/quilljs/parchment/blob/master/src/blot/abstract/shadow.ts
    this.remove()

    // schedule cursor positioning after quill is done with whatever has scheduled
    setTimeout(() => this.quill.setSelection(cursorPosition, 'api'), 0)
  }
}

Quill.register(VerseBlock)

import { Quill } from 'react-quill'
import ReactDOMServer from 'react-dom/server'
import Strong from './Strong'

const Embed = Quill.import('blots/embed')

class StrongBlock extends Embed {
  static blotName = 'block-strong'

  static tagName = 'div'

  static className = 'block-strong'

  static create(data: {
    title: string
    codeStrong: string
    strongType: string
    phonetique: string
    definition: string
    translatedBy: string
    book: string
    original: string
  }) {
    const node = super.create(data)
    const {
      title,
      codeStrong,
      strongType,
      phonetique,
      definition,
      translatedBy,
      book,
      original,
    } = data
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
      const isReadOnly = document
        .querySelector('#editor')
        ?.classList.contains('ql-disabled')
      if (isReadOnly) {
        console.log(`${codeStrong} ${book}`)
        console.log('VIEW_BIBLE_STRONG', {
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

Quill.register(StrongBlock)

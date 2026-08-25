import React from 'react'
import { renderToString } from 'react-dom/server.browser'
import type { StudyEntityEmbedPayload } from '../studyEntityEmbeds'
import { dispatch } from './dispatch'
import { EntityBlock as EntityBlockContent } from './Entity'
import Quill from './quill'
import type { QuillEmbedConstructor, QuillInstance } from './quill-types'

declare const quill: QuillInstance

const Embed = Quill.import('blots/embed') as QuillEmbedConstructor

class EntityBlock extends Embed {
  static blotName = 'block-entity'
  static tagName = 'div'
  static className = 'block-entity'

  static create(data: StudyEntityEmbedPayload) {
    const node = super.create(data)
    node.innerHTML = renderToString(<EntityBlockContent {...data} />)
    node.setAttribute('data', JSON.stringify(data))
    node.setAttribute('contenteditable', 'false')

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor')?.classList.contains('ql-disabled')
      if (isReadOnly) dispatch('VIEW_STUDY_ENTITY', { endpoint: data.endpoint })
    })

    node.querySelector('.block-delete')?.addEventListener('click', event => {
      event.stopPropagation()
      node.remove()
    })

    return node
  }

  static value(domNode: HTMLElement) {
    return JSON.parse(domNode.getAttribute('data') || '{}') as StudyEntityEmbedPayload
  }

  update(mutations: MutationRecord[], context: unknown) {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
        setTimeout(() => this._remove(), 0)
      }
    })
    super.update(
      mutations.filter(mutation => mutation.type !== 'childList'),
      context
    )
  }

  _remove() {
    const cursorPosition = (quill.getSelection()?.index || 0) - 1
    this.remove()
    setTimeout(() => quill.setSelection(cursorPosition, Quill.sources.API), 0)
  }
}

Quill.register(EntityBlock)

export default EntityBlock

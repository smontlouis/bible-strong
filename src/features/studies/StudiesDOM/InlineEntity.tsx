import type { StudyEntityEmbedPayload } from '../studyEntityEmbeds'
import { dispatch } from './dispatch'
import Quill from './quill'
import type { QuillBlotConstructor } from './quill-types'

const Inline = Quill.import('blots/inline') as QuillBlotConstructor

class InlineEntity extends Inline {
  static blotName = 'inline-entity'
  static tagName = 'a'
  static className = 'inline-entity'

  static create(data: StudyEntityEmbedPayload) {
    const node = super.create(data)
    node.setAttribute('data', JSON.stringify(data))
    node.setAttribute('data-entity-type', data.endpoint.type)

    node.addEventListener('click', () => {
      const isReadOnly = document.querySelector('#editor')?.classList.contains('ql-disabled')
      if (isReadOnly) dispatch('VIEW_STUDY_ENTITY', { endpoint: data.endpoint })
    })

    return node
  }

  static formats(domNode: HTMLElement) {
    return JSON.parse(domNode.getAttribute('data') || '{}') as StudyEntityEmbedPayload
  }
}

Quill.register(InlineEntity)

export default InlineEntity

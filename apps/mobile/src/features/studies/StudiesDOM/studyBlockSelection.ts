import Quill from './quill'
import type { QuillBlot, QuillInstance } from './quill-types'

const STUDY_BLOCK_SELECTOR = '.block-entity, .block-verse, .block-strong'
const SELECTED_BLOCK_CLASS = 'study-block-selected'

const getEventElement = (event: Event): Element | null =>
  event.target instanceof Element ? event.target : null

const getStudyBlock = (element: Element | null): HTMLElement | null =>
  element?.closest<HTMLElement>(STUDY_BLOCK_SELECTOR) ?? null

const isEditable = (quill: QuillInstance): boolean =>
  !quill.root.classList.contains('ql-disabled') &&
  !quill.container.classList.contains('ql-disabled')

export const installStudyBlockSelection = (quill: QuillInstance): (() => void) => {
  let selectedBlock: HTMLElement | null = null

  const clearSelectedBlock = () => {
    selectedBlock?.classList.remove(SELECTED_BLOCK_CLASS)
    selectedBlock?.removeAttribute('aria-selected')
    selectedBlock = null
  }

  const selectBlock = (block: HTMLElement) => {
    if (selectedBlock !== block) {
      clearSelectedBlock()
      selectedBlock = block
      selectedBlock.classList.add(SELECTED_BLOCK_CLASS)
      selectedBlock.setAttribute('aria-selected', 'true')
    }

    const blot = Quill.find(block) as QuillBlot | null
    if (blot) {
      quill.setSelection(quill.getIndex(blot) + blot.length(), 0, Quill.sources.SILENT)
    }
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (!isEditable(quill)) return

    const element = getEventElement(event)
    if (element?.closest('.block-delete')) return

    const block = getStudyBlock(element)
    if (!block || !quill.root.contains(block)) {
      clearSelectedBlock()
      return
    }

    event.preventDefault()
    selectBlock(block)
  }

  const handleDelete = (event: MouseEvent) => {
    if (!isEditable(quill)) return

    const element = getEventElement(event)
    if (!element?.closest('.block-delete')) return

    const block = getStudyBlock(element)
    if (!block || !quill.root.contains(block)) return

    const blot = Quill.find(block) as QuillBlot | null
    if (!blot) return

    event.preventDefault()
    event.stopImmediatePropagation()

    const blockIndex = quill.getIndex(blot)
    clearSelectedBlock()
    quill.deleteText(blockIndex, Math.max(1, blot.length()), Quill.sources.USER)

    const cursorIndex = Math.min(blockIndex, Math.max(0, quill.getLength() - 1))
    requestAnimationFrame(() => {
      quill.focus()
      quill.setSelection(cursorIndex, 0, Quill.sources.API)
    })
  }

  const handleSelectionChange = (range: unknown) => {
    if (range && typeof range === 'object' && 'index' in range) {
      clearSelectedBlock()
    }
  }

  quill.root.addEventListener('pointerdown', handlePointerDown)
  quill.root.addEventListener('click', handleDelete, true)
  quill.on(Quill.events.SELECTION_CHANGE, handleSelectionChange)

  return () => {
    clearSelectedBlock()
    quill.root.removeEventListener('pointerdown', handlePointerDown)
    quill.root.removeEventListener('click', handleDelete, true)
    quill.off(Quill.events.SELECTION_CHANGE, handleSelectionChange)
  }
}

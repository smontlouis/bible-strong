'use dom'

import debounce from 'debounce'
import { DOMImperativeFactory, useDOMImperativeHandle } from 'expo/dom'
import { useFonts } from 'expo-font'
import { Ref, useEffect, useRef } from 'react'
import { dispatch } from './dispatch'
import Quill from './quill'
import type { QuillInstance } from './quill'
import './quill.snow.css'

import './InlineStrong'
import './InlineVerse'
import './StrongBlock'
import './VerseBlock'

import './DividerBlock'
import './ModuleBlockVerse'
import './ModuleFormat'
import './ModuleInlineVerse'

interface Props {
  dom: import('expo/dom').DOMProps
  fontFamily: string
  language: string
  contentToDisplay: {
    ops: string[]
  }
  isReadOnly: boolean
  colorScheme: 'light' | 'dark'
  ref?: Ref<StudyDOMRef>
}

export interface StudyDOMRef extends DOMImperativeFactory {
  dispatch: (event: any) => void
  reloadEditor: (content: any) => void
}

function focusEditor(quill: QuillInstance): void {
  quill.focus()
  setTimeout(() => {
    const editor = document.querySelector<HTMLElement>('.ql-editor')
    editor?.focus()
  }, 0)
}

export default function StudiesDOMComponent({
  fontFamily,
  language,
  contentToDisplay,
  isReadOnly,
  colorScheme,
  ref,
}: Props) {
  const [_loaded] = useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

  const quillRef = useRef<QuillInstance | null>(null)

  function onChangeText(delta: any, oldDelta: any, source: any): void {
    dispatch('TEXT_CHANGED', {
      type: 'success',
      delta: quillRef.current!.getContents(),
      deltaChange: delta,
      deltaOld: oldDelta,
      changeSource: source,
    })
  }

  function addTextChangeEventToEditor(): void {
    const quill = quillRef.current!

    quill.on('text-change', debounce(onChangeText, 500))

    quill.on(Quill.events.EDITOR_CHANGE, (type: string, range: any) => {
      const editorDisabled = quill.container.classList.contains('ql-disabled')
      if (editorDisabled) return
      if (type !== Quill.events.SELECTION_CHANGE) return

      if (range) {
        const selectedBottom = quill.getBounds(range).bottom

        setTimeout(() => {
          const windowHeight = document.body.getBoundingClientRect().height

          if (selectedBottom > windowHeight) {
            const editor = document.querySelector<HTMLElement>('.ql-editor')
            if (editor) {
              editor.scrollTo(0, editor.scrollTop + selectedBottom - windowHeight + 30)
            }
          }
        }, 300)
      }
    })
  }

  function loadEditor(options: { fontFamily: string; language: string }): void {
    document.getElementById('editor')!.style.fontFamily = options.fontFamily

    quillRef.current = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: false,
        'inline-verse': true,
        'block-verse': true,
        format: true,
      },
      placeholder:
        options.language === 'fr' ? 'Cr\u00e9er votre \u00e9tude...' : 'Create your study...',
      readOnly: true,
    })

    const quill = quillRef.current
    console.log('[Studies] Editor initialized')

    quill.focus()
    quill.setContents(contentToDisplay, Quill.sources.SILENT)

    addTextChangeEventToEditor()
  }

  useEffect(() => {
    loadEditor({ fontFamily, language })
  }, [])

  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return

    if (!isReadOnly) {
      quill.enable()
      focusEditor(quill)
    } else {
      quill.blur()
      quill.enable(false)
    }
  }, [isReadOnly])

  function handleDispatch(event: any): void {
    const quill = quillRef.current
    if (!quill) return

    try {
      switch (event.type) {
        case 'FOCUS_EDITOR':
          focusEditor(quill)
          break

        case 'BLUR_EDITOR':
          quill.blur()
          break

        case 'GET_BIBLE_VERSES': {
          const inlineModule = quill.getModule('inline-verse')
          inlineModule.receiveVerseLink(event.payload)
          break
        }

        case 'GET_BIBLE_STRONG': {
          const inlineModule = quill.getModule('inline-verse')
          inlineModule.receiveStrongLink(event.payload)
          break
        }

        case 'GET_BIBLE_VERSES_BLOCK': {
          const blockModule = quill.getModule('block-verse')
          blockModule.receiveVerseBlock(event.payload)
          break
        }

        case 'GET_BIBLE_STRONG_BLOCK': {
          const blockModule = quill.getModule('block-verse')
          blockModule.receiveStrongBlock(event.payload)
          break
        }

        case 'BLOCK_DIVIDER': {
          const range = quill.getSelection(true)
          if (range) {
            quill.insertEmbed(range.index, 'divider', true, Quill.sources.USER)
            quill.setSelection(range.index + 1, Quill.sources.SILENT)
          }
          break
        }

        case 'TOGGLE_FORMAT': {
          const formatModule = quill.getModule('format')
          const { type, value } = event.payload

          console.log(`[Studies] ${type} ${value}`)

          if (type === 'UNDO') {
            quill.history.undo()
          } else if (type === 'REDO') {
            quill.history.redo()
          } else {
            const formatName = type.toLowerCase()
            formatModule.format(formatName, value)
          }
          break
        }

        default:
          console.log(
            `[Studies] reactQuillEditor Error: Unhandled message type received "${event.type}"`
          )
      }
    } catch (err) {
      console.log(`[Studies] reactQuillEditor error: ${err}`)
    }
  }

  useDOMImperativeHandle(
    ref as Ref<StudyDOMRef>,
    () => ({
      dispatch: handleDispatch,
      reloadEditor: (content: any) => {
        if (quillRef.current) {
          quillRef.current.setContents(content, Quill.sources.SILENT)
        }
      },
    }),
    []
  )

  return (
    <div
      id="editor"
      style={{
        filter: colorScheme === 'dark' ? 'invert(1) hue-rotate(180deg)' : 'none',
      }}
    />
  )
}

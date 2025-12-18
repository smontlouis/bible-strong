'use dom'

import debounce from 'debounce'
import { DOMImperativeFactory, useDOMImperativeHandle } from 'expo/dom'
import { Ref, useEffect, useRef } from 'react'
import { dispatch } from './dispatch'
// @ts-ignore
import Quill from './quill'
import './quill.snow.css'

import './InlineStrong'
import './InlineVerse'
import './StrongBlock'
import './VerseBlock'

import { useFonts } from 'expo-font'
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
}

export default function StudiesDOMComponent({
  fontFamily,
  language,
  contentToDisplay,
  isReadOnly,
  colorScheme,
  ref,
}: Props) {
  const [loaded] = useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

  const quillRef = useRef<any>(null)
  const inlineVerseModuleRef = useRef<any>(null)
  const blockVerseModuleRef = useRef<any>(null)
  const formatModuleRef = useRef<any>(null)

  useEffect(() => {
    loadEditor({ fontFamily, language })
  }, [])

  useEffect(() => {
    if (!isReadOnly) {
      // Can edit
      // @ts-ignore
      quillRef.current.enable()
      // @ts-ignore
      quillRef.current.focus()

      // @ts-ignore
      quillRef.current.focus()
      setTimeout(() => {
        // @ts-ignore
        document.querySelector('.ql-editor').focus()
      }, 0)
    } else {
      // Read only
      // @ts-ignore
      quillRef.current.blur()
      // @ts-ignore
      quillRef.current.enable(false)

      // Blur
      // @ts-ignore
      quillRef.current.blur()
    }
  }, [isReadOnly])

  useDOMImperativeHandle(
    // @ts-ignore - ref is optional in React 19 pattern
    ref,
    () => ({
      dispatch: (event: any) => {
        try {
          const msgData = event

          switch (msgData.type) {
            case 'FOCUS_EDITOR':
              // @ts-ignore
              quillRef.current.focus()
              setTimeout(() => {
                // @ts-ignore
                document.querySelector('.ql-editor').focus()
              }, 0)
              break
            case 'BLUR_EDITOR':
              // @ts-ignore
              quillRef.current.blur()
              break
            case 'GET_BIBLE_VERSES':
              // @ts-ignore
              inlineVerseModuleRef.current =
                // @ts-ignore
                quillRef.current.getModule('inline-verse')
              // @ts-ignore
              inlineVerseModuleRef.current.receiveVerseLink(msgData.payload)
              break
            case 'GET_BIBLE_STRONG':
              // @ts-ignore
              inlineVerseModuleRef.current =
                // @ts-ignore
                quillRef.current.getModule('inline-verse')
              // @ts-ignore
              inlineVerseModuleRef.current.receiveStrongLink(msgData.payload)
              break
            case 'GET_BIBLE_VERSES_BLOCK':
              // @ts-ignore
              blockVerseModuleRef.current =
                // @ts-ignore
                quillRef.current.getModule('block-verse')
              // @ts-ignore
              blockVerseModuleRef.current.receiveVerseBlock(msgData.payload)
              break
            case 'GET_BIBLE_STRONG_BLOCK':
              // @ts-ignore
              blockVerseModuleRef.current =
                // @ts-ignore
                quillRef.current.getModule('block-verse')
              // @ts-ignore
              blockVerseModuleRef.current.receiveStrongBlock(msgData.payload)
              break
            case 'BLOCK_DIVIDER': {
              // @ts-ignore
              const range = quillRef.current.getSelection(true)
              // @ts-ignore
              quillRef.current.insertEmbed(range.index, 'divider', true, Quill.sources.USER)
              // @ts-ignore
              quillRef.current.setSelection(range.index + 1, Quill.sources.SILENT)
              break
            }
            case 'TOGGLE_FORMAT': {
              // @ts-ignore
              formatModuleRef.current = quillRef.current.getModule('format')
              const { type, value } = msgData.payload

              console.log(`[Studies] ${type} ${value}`)

              switch (type) {
                case 'UNDO':
                  // @ts-ignore
                  quillRef.current.history.undo()
                  break
                case 'REDO':
                  // @ts-ignore
                  quillRef.current.history.redo()
                  break
                case 'BOLD':
                  // @ts-ignore
                  formatModuleRef.current.format('bold', value)
                  break
                case 'ITALIC':
                  // @ts-ignore
                  formatModuleRef.current.format('italic', value)
                  break
                case 'UNDERLINE':
                  // @ts-ignore
                  formatModuleRef.current.format('underline', value)
                  break
                case 'BLOCKQUOTE':
                  // @ts-ignore
                  formatModuleRef.current.format('blockquote', value)
                  break
                case 'LIST':
                  // @ts-ignore
                  formatModuleRef.current.format('list', value)
                  break
                case 'HEADER':
                  // @ts-ignore
                  formatModuleRef.current.format('header', value)
                  break
                case 'BACKGROUND':
                  // @ts-ignore
                  formatModuleRef.current.format('background', value)
                  break
                case 'COLOR':
                  // @ts-ignore
                  formatModuleRef.current.format('color', value)
                  break
                default:
                  break
              }
              break
            }
            default:
              console.log(
                `[Studies] reactQuillEditor Error: Unhandled message type received "${msgData.type}"`
              )
          }
        } catch (err) {
          console.log(`[Studies] reactQuillEditor error: ${err}`)
        }
      },
      reloadEditor: (content: any) => {
        if (quillRef.current) {
          // @ts-ignore
          quillRef.current.setContents(content, Quill.sources.SILENT)
        }
      },
    }),
    []
  )

  const onChangeText = (delta: any, oldDelta: any, source: any) => {
    dispatch('TEXT_CHANGED', {
      type: 'success',
      // @ts-ignore
      delta: quillRef.current.getContents(),
      deltaChange: delta,
      deltaOld: oldDelta,
      changeSource: source,
    })
  }

  const addTextChangeEventToEditor = () => {
    // @ts-ignore
    quillRef.current.on('text-change', debounce(onChangeText, 500))

    // @ts-ignore
    quillRef.current.on(Quill.events.EDITOR_CHANGE, (type: any, range: any) => {
      const isReadOnly =
        // @ts-ignore
        quillRef.current.container.classList.contains('ql-disabled')

      if (isReadOnly) return
      if (type !== Quill.events.SELECTION_CHANGE) return

      if (range) {
        // @ts-ignore
        const selectedBottom = quillRef.current.getBounds(range).bottom

        setTimeout(() => {
          const windowHeight = document.body.getBoundingClientRect().height

          if (selectedBottom > windowHeight) {
            // @ts-ignore
            document
              .querySelector('.ql-editor')
              // @ts-ignore
              .scrollTo(
                0,
                // @ts-ignore
                document.querySelector('.ql-editor').scrollTop + selectedBottom - windowHeight + 30
              )
          }
        }, 300)
      }
    })
  }

  const loadEditor = ({ fontFamily, language }: { fontFamily: string; language: string }) => {
    document.getElementById('editor')!.style.fontFamily = fontFamily
    // @ts-ignore
    quillRef.current = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: false,
        'inline-verse': true,
        'block-verse': true,
        format: true,
      },
      placeholder: language === 'fr' ? 'Créer votre étude...' : 'Create your study...',
      readOnly: true,
    })

    console.log('[Studies] Loading editor')
    // @ts-ignore
    quillRef.current.focus()

    console.log('[Studies] Editor initialized')

    // @ts-ignore
    quillRef.current.setContents(contentToDisplay, Quill.sources.SILENT)

    addTextChangeEventToEditor()
  }

  return (
    <div
      id="editor"
      style={{
        filter: colorScheme === 'dark' ? 'invert(1) hue-rotate(180deg)' : 'none',
      }}
    />
  )
}

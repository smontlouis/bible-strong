'use dom'

import { DOMImperativeFactory, useDOMImperativeHandle } from 'expo/dom'
import { forwardRef, useEffect, useRef } from 'react'
import { dispatch } from './dispatch'
import Quill from './quill'
import debounce from 'debounce'
import './quill.snow.css'

import './InlineStrong'
import './InlineVerse'
import './StrongBlock'
import './VerseBlock'

import './DividerBlock'
import './ModuleBlockVerse'
import './ModuleFormat'
import './ModuleInlineVerse'
import { useFonts } from 'expo-font'

interface Props {
  dom: import('expo/dom').DOMProps
  fontFamily: string
  language: string
  contentToDisplay: {
    ops: string[]
  }
  isReadOnly: boolean
}

export interface StudyDOMRef extends DOMImperativeFactory {
  dispatch: (event: any) => void
}

export default forwardRef<StudyDOMRef, Props>(function MyComponent(
  { fontFamily, language, contentToDisplay, isReadOnly },
  ref
) {
  const [loaded] = useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

  const quillRef = useRef(null)
  const inlineVerseModuleRef = useRef(null)
  const blockVerseModuleRef = useRef(null)
  const formatModuleRef = useRef(null)

  useEffect(() => {
    loadEditor({ fontFamily, language })
  }, [])

  useEffect(() => {
    if (!isReadOnly) {
      // Can edit
      quillRef.current.enable()
      quillRef.current.focus()

      quillRef.current.focus()
      setTimeout(() => {
        document.querySelector('.ql-editor').focus()
      }, 0)
    } else {
      // Read only
      quillRef.current.blur()
      quillRef.current.enable(false)

      // Blur
      quillRef.current.blur()
    }
  }, [isReadOnly])

  useDOMImperativeHandle(
    ref,
    () => ({
      dispatch: event => {
        try {
          const msgData = event

          switch (msgData.type) {
            case 'FOCUS_EDITOR':
              quillRef.current.focus()
              setTimeout(() => {
                document.querySelector('.ql-editor').focus()
              }, 0)
              break
            case 'BLUR_EDITOR':
              quillRef.current.blur()
              break
            case 'GET_BIBLE_VERSES':
              inlineVerseModuleRef.current = quillRef.current.getModule(
                'inline-verse'
              )
              inlineVerseModuleRef.current.receiveVerseLink(msgData.payload)
              break
            case 'GET_BIBLE_STRONG':
              inlineVerseModuleRef.current = quillRef.current.getModule(
                'inline-verse'
              )
              inlineVerseModuleRef.current.receiveStrongLink(msgData.payload)
              break
            case 'GET_BIBLE_VERSES_BLOCK':
              blockVerseModuleRef.current = quillRef.current.getModule(
                'block-verse'
              )
              blockVerseModuleRef.current.receiveVerseBlock(msgData.payload)
              break
            case 'GET_BIBLE_STRONG_BLOCK':
              blockVerseModuleRef.current = quillRef.current.getModule(
                'block-verse'
              )
              blockVerseModuleRef.current.receiveStrongBlock(msgData.payload)
              break
            case 'BLOCK_DIVIDER': {
              const range = quillRef.current.getSelection(true)
              quillRef.current.insertEmbed(
                range.index,
                'divider',
                true,
                Quill.sources.USER
              )
              quillRef.current.setSelection(
                range.index + 1,
                Quill.sources.SILENT
              )
              break
            }
            case 'TOGGLE_FORMAT': {
              formatModuleRef.current = quillRef.current.getModule('format')
              const { type, value } = msgData.payload

              console.log(`${type} ${value}`)

              switch (type) {
                case 'UNDO':
                  quillRef.current.history.undo()
                  break
                case 'REDO':
                  quillRef.current.history.redo()
                  break
                case 'BOLD':
                  formatModuleRef.current.format('bold', value)
                  break
                case 'ITALIC':
                  formatModuleRef.current.format('italic', value)
                  break
                case 'UNDERLINE':
                  formatModuleRef.current.format('underline', value)
                  break
                case 'BLOCKQUOTE':
                  formatModuleRef.current.format('blockquote', value)
                  break
                case 'LIST':
                  formatModuleRef.current.format('list', value)
                  break
                case 'HEADER':
                  formatModuleRef.current.format('header', value)
                  break
                case 'BACKGROUND':
                  formatModuleRef.current.format('background', value)
                  break
                case 'COLOR':
                  formatModuleRef.current.format('color', value)
                  break
                default:
                  break
              }
              break
            }
            default:
              console.log(
                `reactQuillEditor Error: Unhandled message type received "${msgData.type}"`
              )
          }
        } catch (err) {
          console.log(`reactQuillEditor error: ${err}`)
        }
      },
    }),
    []
  )

  const onChangeText = (delta, oldDelta, source) => {
    dispatch('TEXT_CHANGED', {
      type: 'success',
      delta: quillRef.current.getContents(),
      deltaChange: delta,
      deltaOld: oldDelta,
      changeSource: source,
    })
  }

  const addTextChangeEventToEditor = () => {
    quillRef.current.on('text-change', debounce(onChangeText, 500))

    quillRef.current.on(Quill.events.EDITOR_CHANGE, (type, range) => {
      const isReadOnly = quillRef.current.container.classList.contains(
        'ql-disabled'
      )

      if (isReadOnly) return
      if (type !== Quill.events.SELECTION_CHANGE) return

      if (range) {
        const selectedBottom = quillRef.current.getBounds(range).bottom

        setTimeout(() => {
          const windowHeight = document.body.getBoundingClientRect().height

          if (selectedBottom > windowHeight) {
            document
              .querySelector('.ql-editor')
              .scrollTo(
                0,
                document.querySelector('.ql-editor').scrollTop +
                  selectedBottom -
                  windowHeight +
                  30
              )
          }
        }, 300)
      }
    })
  }

  const loadEditor = ({
    fontFamily,
    language,
  }: {
    fontFamily: string
    language: string
  }) => {
    document.getElementById('editor')!.style.fontFamily = fontFamily
    quillRef.current = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: false,
        'inline-verse': true,
        'block-verse': true,
        format: true,
      },
      placeholder:
        language === 'fr' ? 'Créer votre étude...' : 'Create your study...',
      readOnly: true,
    })

    console.log('loading editor')
    quillRef.current.focus()

    console.log('editor initialized')

    quillRef.current.setContents(contentToDisplay, Quill.sources.SILENT)

    addTextChangeEventToEditor()
  }

  return <div id="editor" />
})

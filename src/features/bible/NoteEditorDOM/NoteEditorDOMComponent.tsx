'use dom'

import { useEffect, useRef } from 'react'

interface Props {
  dom?: import('expo/dom').DOMProps
  defaultTitle: string
  defaultDescription: string
  isEditing: boolean
  colorScheme: 'light' | 'dark'
  placeholderTitle: string
  placeholderDescription: string
  // Native actions (callbacks passées directement - async côté DOM, void côté RN)
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSizeChange: (width: number, height: number) => void
  onFocus?: () => void
  onBlur?: () => void
}

export default function NoteEditorDOMComponent({
  defaultTitle,
  defaultDescription,
  isEditing,
  colorScheme,
  placeholderTitle,
  placeholderDescription,
  onTitleChange,
  onDescriptionChange,
  onSizeChange,
  onFocus,
  onBlur,
}: Props) {
  const titleRef = useRef<HTMLDivElement>(null)
  const descriptionRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ResizeObserver to report size changes to native
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        onSizeChange(width, height)
      }
    })

    observer.observe(container)

    // Report initial size
    const { offsetWidth, offsetHeight } = container
    onSizeChange(offsetWidth, offsetHeight)

    return () => observer.disconnect()
  }, [onSizeChange])

  // Set initial content only on mount (uncontrolled)
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.innerText = defaultTitle
    }
    if (descriptionRef.current) {
      descriptionRef.current.innerText = defaultDescription
    }
  }, []) // Empty deps = only on mount

  // Focus title when entering edit mode
  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus()
    }
  }, [isEditing])

  // Appel direct des native actions (async par nature)
  const handleTitleInput = () => {
    onTitleChange(titleRef.current?.innerText || '')
  }

  const handleDescriptionInput = () => {
    onDescriptionChange(descriptionRef.current?.innerText || '')
  }

  // Wrap focus/blur to avoid passing DOM event objects (not serializable)
  const handleFocus = () => {
    onFocus?.()
  }

  const handleBlur = () => {
    onBlur?.()
  }

  const isDark = colorScheme === 'dark'
  const textColor = isDark ? '#fff' : '#000'
  const bgColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const placeholderColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'

  return (
    <div
      ref={containerRef}
      style={{ fontFamily: 'system-ui', color: textColor, overflow: 'hidden', width: '100%' }}
    >
      {/* Title */}
      <div
        ref={titleRef}
        contentEditable={isEditing}
        onInput={handleTitleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-placeholder={placeholderTitle}
        style={{
          padding: 5,
          backgroundColor: isEditing ? bgColor : 'transparent',
          borderRadius: 8,
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 10,
          outline: 'none',
          whiteSpace: 'pre-wrap',
        }}
      />
      {/* Description */}
      <div
        ref={descriptionRef}
        contentEditable={isEditing}
        onInput={handleDescriptionInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-placeholder={placeholderDescription}
        style={{
          padding: 5,
          backgroundColor: isEditing ? bgColor : 'transparent',
          borderRadius: 8,
          fontSize: 14,
          outline: 'none',
          whiteSpace: 'pre-wrap',
          minHeight: 200,
        }}
      />
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          height: auto;
          overflow: hidden;
        }
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: ${placeholderColor};
        }
        [contenteditable]:focus {
          outline: none;
        }
      `}</style>
    </div>
  )
}

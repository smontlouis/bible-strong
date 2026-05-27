'use dom'

import { useEffect, useRef } from 'react'

const MIN_EDITOR_HEIGHT = 240

interface Props {
  dom?: import('expo/dom').DOMProps
  defaultTitle: string
  defaultDescription: string
  resetKey?: number
  isEditing: boolean
  colorScheme: 'light' | 'dark'
  placeholderTitle: string
  placeholderDescription: string
  // Native action callbacks
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSizeChange: (width: number, height: number) => void
  onFocus?: () => void
  onBlur?: () => void
}

export default function NoteEditorDOMComponent({
  defaultTitle,
  defaultDescription,
  resetKey,
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

    const reportSize = () => {
      const width = container.offsetWidth || container.scrollWidth
      const height = Math.max(container.offsetHeight, container.scrollHeight, MIN_EDITOR_HEIGHT)
      onSizeChange(width, height)
    }

    if (typeof ResizeObserver === 'undefined') {
      reportSize()
      return
    }

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        onSizeChange(width, Math.max(height, container.scrollHeight, MIN_EDITOR_HEIGHT))
      }
    })

    observer.observe(container)

    requestAnimationFrame(reportSize)

    return () => observer.disconnect()
  }, [onSizeChange])

  // Keep the uncontrolled contenteditable nodes in sync when the native side
  // explicitly resets the editor, for example after canceling an edit.
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.innerText = defaultTitle
    }
    if (descriptionRef.current) {
      descriptionRef.current.innerText = defaultDescription
    }
    requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const width = container.offsetWidth || container.scrollWidth
      const height = Math.max(container.offsetHeight, container.scrollHeight, MIN_EDITOR_HEIGHT)
      onSizeChange(width, height)
    })
  }, [defaultTitle, defaultDescription, resetKey])

  // Focus title when entering edit mode
  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus()
    }
  }, [isEditing])

  const handleTitleInput = () => {
    onTitleChange(titleRef.current?.innerText || '')
  }

  const handleDescriptionInput = () => {
    onDescriptionChange(descriptionRef.current?.innerText || '')
  }

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
      style={{
        fontFamily: 'system-ui',
        color: textColor,
        overflow: 'hidden',
        width: '100%',
        minHeight: MIN_EDITOR_HEIGHT,
        animation: 'fade 300ms ease-out',
      }}
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
        @keyframes fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
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

import { useEffect, useRef, type KeyboardEventHandler, type ReactNode, type RefObject } from 'react'
import { ControlIcon } from './ControlIcon'
import './modal.css'

/** Shared native modal: focus containment, Escape, backdrop and one close control. */
export function Modal({
  children,
  className = '',
  labelledBy,
  closeLabel,
  onClose,
  closeDisabled = false,
  initialFocus,
  onKeyDown,
}: {
  children: ReactNode
  className?: string
  labelledBy: string
  closeLabel: string
  onClose: () => void
  closeDisabled?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closing = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  function requestClose() {
    if (closeDisabled || closing.current) return
    closing.current = true
    const element = dialog.current!
    element.dataset.closing = 'true'
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    closeTimer.current = setTimeout(onClose, 160)
  }
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current!
    element.showModal()
    initialFocus?.current?.focus()
    return () => {
      clearTimeout(closeTimer.current)
      element.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [initialFocus])
  return (
    <dialog
      ref={dialog}
      className={`world-modal ${className}`}
      aria-labelledby={labelledBy}
      onClickCapture={event => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-modal-close]')
        ) {
          event.stopPropagation()
          requestClose()
        }
      }}
      onCancel={event => {
        event.preventDefault()
        requestClose()
      }}
      onClick={event => {
        if (event.target !== event.currentTarget || closeDisabled) return
        const bounds = event.currentTarget.getBoundingClientRect()
        // Clicking dialog padding is not a backdrop click.
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          requestClose()
      }}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="world-modal-close"
        aria-label={closeLabel}
        disabled={closeDisabled}
        onClick={requestClose}
      >
        <ControlIcon name="close" />
      </button>
      {children}
    </dialog>
  )
}

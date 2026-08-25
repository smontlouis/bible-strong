import { useEffect, useEffectEvent, useRef } from 'react'

import { SET_BIBLE_OVERLAY_OPEN } from './dispatch'
import { useDispatch } from './DispatchProvider'

type ModalOverlayFocus = {
  selector: string
  refreshKey?: unknown
  trap?: boolean
}

type ModalOverlayLifecycleOptions = {
  isOpen: boolean
  onClose: () => void
  focus?: ModalOverlayFocus
}

export const useBibleOverlayOpen = (isOpen: boolean) => {
  const dispatch = useDispatch()

  useEffect(() => {
    if (!isOpen) return

    void dispatch({ type: SET_BIBLE_OVERLAY_OPEN, payload: true })
    return () => {
      void dispatch({ type: SET_BIBLE_OVERLAY_OPEN, payload: false })
    }
  }, [dispatch, isOpen])
}

export const useModalOverlayLifecycle = ({
  isOpen,
  onClose,
  focus,
}: ModalOverlayLifecycleOptions) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const handleClose = useEffectEvent(onClose)
  const focusSelector = focus?.selector
  const focusRefreshKey = focus?.refreshKey
  const trapFocus = focus?.trap ?? false

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.documentElement.style.overflow
    const previousSwipeDownEvent = window.disableSwipeDownEvent
    const previouslyFocusedElement = document.activeElement as HTMLElement | null
    const overlayElement = overlayRef.current
    const backgroundElements = Array.from(document.body.children).filter(
      element => element !== overlayElement
    ) as HTMLElement[]
    const backgroundStates = backgroundElements.map(element => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))

    window.disableSwipeDownEvent = true
    document.documentElement.style.overflow = 'hidden'
    backgroundElements.forEach(element => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
        return
      }

      if (event.key !== 'Tab' || !trapFocus || !overlayElement || !focusSelector) return
      const focusableElements = Array.from(
        overlayElement.querySelectorAll<HTMLElement>(focusSelector)
      )
      if (!focusableElements.length) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.documentElement.style.overflow = previousOverflow
      window.disableSwipeDownEvent = previousSwipeDownEvent
      backgroundStates.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
      previouslyFocusedElement?.focus()
    }
  }, [focusSelector, isOpen, trapFocus])

  useEffect(() => {
    if (!isOpen || !focusSelector) return

    requestAnimationFrame(() =>
      overlayRef.current?.querySelector<HTMLElement>(focusSelector)?.focus()
    )
  }, [focusRefreshKey, focusSelector, isOpen])

  return overlayRef
}

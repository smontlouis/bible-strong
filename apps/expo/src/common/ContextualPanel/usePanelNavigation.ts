import { useState } from 'react'
import type { ContextualPanelProps } from './types'
export function usePanelNavigation({
  initialScreen,
  screens,
  onClose,
  onOpen,
}: ContextualPanelProps) {
  const [isOpen, setOpen] = useState(false)
  const [history, setHistory] = useState([initialScreen])
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const screen = screens[history[history.length - 1]] ?? screens[initialScreen]
  const close = () => {
    setOpen(false)
    setHistory([initialScreen])
    if (isOpen) onClose?.()
  }
  return {
    isOpen,
    screen,
    screenKey: history.join('/'),
    direction,
    canGoBack: history.length > 1,
    present: () => {
      onOpen?.()
      setHistory([initialScreen])
      setDirection('forward')
      setOpen(true)
    },
    navigation: {
      open: (name: string) => {
        if (screens[name]) {
          setDirection('forward')
          setHistory(current => [...current, name])
        }
      },
      back: () => {
        if (history.length <= 1) return
        setDirection('backward')
        setHistory(current => current.slice(0, -1))
      },
      close,
    },
  }
}

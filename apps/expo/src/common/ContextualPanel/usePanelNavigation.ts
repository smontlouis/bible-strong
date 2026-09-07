import { useState } from 'react'
import type { ContextualPanelProps } from './types'
export function usePanelNavigation({ initialScreen, screens, onClose }: ContextualPanelProps) {
  const [isOpen, setOpen] = useState(false)
  const [history, setHistory] = useState([initialScreen])
  const screen = screens[history[history.length - 1]] ?? screens[initialScreen]
  const close = () => {
    setOpen(false)
    setHistory([initialScreen])
    if (isOpen) onClose?.()
  }
  return {
    isOpen,
    screen,
    canGoBack: history.length > 1,
    present: () => {
      setHistory([initialScreen])
      setOpen(true)
    },
    navigation: {
      open: (name: string) => {
        if (screens[name]) setHistory(current => [...current, name])
      },
      back: () => setHistory(current => (current.length > 1 ? current.slice(0, -1) : current)),
      close,
    },
  }
}

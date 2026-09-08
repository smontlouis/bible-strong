import { useRef, useState } from 'react'
import type { ContextualPanelProps, PanelScreen } from './types'
export function usePanelNavigation({
  initialScreen,
  screens,
  onClose,
  onOpen,
}: ContextualPanelProps) {
  const [isOpen, setOpen] = useState(false)
  const openRef = useRef(false)
  const nextScreen = useRef(0)
  const [inlineScreens, setInlineScreens] = useState<Record<string, PanelScreen>>({})
  const [history, setHistory] = useState([initialScreen])
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const screen =
    screens[history[history.length - 1]] ??
    inlineScreens[history[history.length - 1]] ??
    screens[initialScreen]
  const close = () => {
    if (!openRef.current) return
    openRef.current = false
    setOpen(false)
    setHistory([initialScreen])
    setInlineScreens({})
    onClose?.()
  }
  return {
    frames: history.map((name, index) => ({
      key: history.slice(0, index + 1).join('/'),
      screen: screens[name] ?? inlineScreens[name] ?? screens[initialScreen],
    })),
    isOpen,
    screen,
    screenKey: history.join('/'),
    direction,
    canGoBack: history.length > 1,
    present: () => {
      if (openRef.current) return
      openRef.current = true
      onOpen?.()
      setHistory([initialScreen])
      setDirection('forward')
      setOpen(true)
    },
    navigation: {
      openScreen: (screen: PanelScreen) => {
        const key = `inline-screen-${++nextScreen.current}`
        setInlineScreens(current => ({ ...current, [key]: screen }))
        setDirection('forward')
        setHistory(current => [...current, key])
      },
      open: (name: string) => {
        if (screens[name]) {
          screens[name].onEnter?.()
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

import { useEffect, useEffectEvent, useRef, useState } from 'react'

type Group = { id: string; name: string; color?: string }
type Save = (data: { groupId: string; name: string; color: string }) => void
export const GROUP_RENAME_DEBOUNCE_MS = 300

export function useDebouncedGroupEdit(group: Group, save: Save) {
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color ?? '')
  const draft = useRef({ name: group.name, color: group.color ?? '' })
  const saved = useRef(draft.current)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flush = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    const next = {
      name: draft.current.name.trim() || saved.current.name,
      color: draft.current.color,
    }
    if (next.name === saved.current.name && next.color === saved.current.color) return
    saved.current = next
    save({ groupId: group.id, ...next })
  }
  const flushOnUnmount = useEffectEvent(flush)
  useEffect(
    () => () => {
      // Keep the final keystroke when navigation unmounts the menu.
      flushOnUnmount()
    },
    []
  )
  return {
    name,
    color,
    flush,
    reset: () => {
      clearTimeout(timer.current)
      draft.current = { name: group.name, color: group.color ?? '' }
      saved.current = draft.current
      setName(group.name)
      setColor(group.color ?? '')
    },
    changeName: (name: string) => {
      draft.current = { ...draft.current, name }
      setName(name)
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, GROUP_RENAME_DEBOUNCE_MS)
    },
    changeColor: (color: string) => {
      draft.current = { ...draft.current, color }
      setColor(color)
      flush()
    },
  }
}

import { Fragment, type ReactNode } from 'react'
import { motion } from 'motion/react'

import { isMacPlatform, shortcutKeys, type ShortcutId } from '~features/keyboard-shortcuts/keymap'

type KeycapProps = {
  /** The keys as printed on the keyboard, in order: `['⇧', 'R']`. */
  keys: string[]
  /** Clicking a key does what pressing it does. */
  onPress?: () => void
  active?: boolean
  small?: boolean
  /** Changes each time the reader should press this key: the key shakes once. */
  nudge?: number
  label?: string
}

/** A key of the keyboard, set in the text. */
export function Keycap({ keys, onPress, active, small, nudge, label }: KeycapProps) {
  const className = `bs-onb-key${small ? ' bs-onb-key-small' : ''}`
  const content = keys.map((key, index) => <Fragment key={`${key}-${index}`}>{key}</Fragment>)
  const shake = nudge ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }
  if (!onPress)
    return (
      <motion.kbd
        key={nudge}
        className={className}
        data-active={active}
        animate={shake}
        transition={{ duration: 0.36 }}
      >
        {content}
      </motion.kbd>
    )
  return (
    <motion.button
      key={nudge}
      type="button"
      className={className}
      data-active={active}
      aria-label={label}
      animate={shake}
      transition={{ duration: 0.36 }}
      onMouseDown={event => event.preventDefault()}
      onClick={onPress}
    >
      {content}
    </motion.button>
  )
}

/** The keys of a shortcut of the app, as the keymap prints them on this system. */
export const keysOf = (id: ShortcutId) => shortcutKeys(id, isMacPlatform())

/**
 * A translated sentence with keys in it. The translation marks a key with `%{name}`, which
 * i18next leaves alone, and `slots` gives each name its key.
 */
export function withKeys(template: string, slots: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(%\{\w+\})/).map((part, index) => {
    const match = /^%\{(\w+)\}$/.exec(part)
    return match ? (
      <Fragment key={index}>{slots[match[1]] ?? part}</Fragment>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  })
}

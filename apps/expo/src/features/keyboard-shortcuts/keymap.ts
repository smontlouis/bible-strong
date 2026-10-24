/**
 * Every keyboard shortcut of the web app in one place: the listeners match their events against
 * it, and the guide, the settings page and the hints beside the actions print it.
 *
 * Three families, each with its role. ⌘ (Ctrl elsewhere) + a letter is kept for the few globals
 * every browser lets through. ⌃ on a Mac (Alt elsewhere) + a letter drives the workspace tabs: no
 * browser takes it, unlike ⌘T, ⌘W or ⌘⌥ combinations. A letter alone acts on what the reader looks
 * at, the Bible or the selection, as long as no field has the focus. One letter means one thing
 * across the app, and Shift gives the other action that starts with the same letter, in French as
 * in English: C compares and ⇧C opens the commentary, T tags and ⇧T opens the themes.
 */

type Chord = {
  /** A letter (`'T'`), a digit (`'0'`), `'digit'` for 1 to 9, or a key's own name (`'ArrowUp'`, `'?'`). */
  key: string
  /** ⌘ on a Mac, Ctrl elsewhere. */
  command?: boolean
  /** ⌃ on a Mac, Alt elsewhere: the workspace's own family. */
  workspace?: boolean
  /** ⌥ on a Mac, Alt elsewhere. */
  option?: boolean
  /** `'any'` ignores Shift, for a character some layouts only type with it (`?`, AZERTY digits). */
  shift?: boolean | 'any'
}

export const SHORTCUTS = {
  palette: [{ key: 'K', command: true }],
  tabActions: [{ key: 'K', command: true, shift: true }],
  newTab: [{ key: 'T', workspace: true }],
  closeTab: [{ key: 'W', workspace: true }],
  recentTabs: [{ key: 'Q', workspace: true, shift: 'any' }],
  previousTab: [{ key: 'ArrowUp', option: true }],
  nextTab: [{ key: 'ArrowDown', option: true }],
  sidebar: [{ key: 'B', command: true }],
  guide: [{ key: '?', shift: 'any' }],
  // Inside the palette, where its list handles them
  paletteUp: [{ key: 'ArrowUp' }],
  paletteDown: [{ key: 'ArrowDown' }],
  paletteSelect: [{ key: 'Enter' }],
  paletteClose: [{ key: 'Escape' }],
  paletteRemoveFilter: [{ key: 'Backspace' }],
  // A Bible tab
  previousChapter: [{ key: 'ArrowLeft' }],
  nextChapter: [{ key: 'ArrowRight' }],
  goToVerse: [{ key: 'V' }],
  strongMode: [{ key: 'S' }],
  nextVerse: [{ key: 'J' }],
  previousVerse: [{ key: 'K' }],
  extendNext: [{ key: 'J', shift: true }],
  extendPrevious: [{ key: 'K', shift: true }],
  // Selected verses
  highlight: [{ key: 'digit', shift: 'any' }],
  removeHighlight: [{ key: '0', shift: 'any' }],
  note: [{ key: 'N' }],
  tags: [{ key: 'T' }],
  link: [{ key: 'L' }],
  relation: [{ key: 'R', shift: true }],
  bookmark: [{ key: 'B' }],
  addToStudy: [{ key: 'A' }],
  focus: [{ key: 'F' }],
  lexicon: [{ key: 'S' }],
  dictionary: [{ key: 'D' }],
  topics: [{ key: 'T', shift: true }],
  references: [{ key: 'R' }],
  commentary: [{ key: 'C', shift: true }],
  compare: [{ key: 'C' }],
  copy: [{ key: 'C', command: true }],
  selectAll: [{ key: 'A', command: true }],
  deselect: [{ key: 'Escape' }],
  // An annotation
  erase: [{ key: 'Backspace' }, { key: 'Delete' }],
} satisfies Record<string, Chord[]>

export type ShortcutId = keyof typeof SHORTCUTS

export type ShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'isComposing'
> & {
  keyCode?: number
  getModifierState?: KeyboardEvent['getModifierState']
}

export const isMacPlatform = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

const isAltGraph = (event: ShortcutEvent) =>
  event.key === 'AltGraph' ||
  (typeof event.getModifierState === 'function'
    ? event.getModifierState('AltGraph')
    : event.ctrlKey && event.altKey)

/** The letter of the key on the reader's layout, even when Option turns it into a symbol. */
function letterOf(event: ShortcutEvent) {
  if (/^[a-z]$/i.test(event.key)) return event.key.toUpperCase()
  // Chromium/WebKit's legacy virtual letter code keeps the layout's letter under Option, unlike
  // the physical event.code on AZERTY.
  if (event.keyCode && event.keyCode >= 65 && event.keyCode <= 90)
    return String.fromCharCode(event.keyCode)
  return /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : undefined
}

/** The digit of a key of the top row or the keypad: AZERTY types `&é"'` there without Shift. */
export function digitOf(event: Pick<KeyboardEvent, 'code'>) {
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(event.code)
  return match ? Number(match[1]) : undefined
}

function matchesChord(event: ShortcutEvent, chord: Chord, mac: boolean) {
  const expected = mac
    ? { metaKey: !!chord.command, ctrlKey: !!chord.workspace, altKey: !!chord.option }
    : { metaKey: false, ctrlKey: !!chord.command, altKey: !!(chord.workspace || chord.option) }
  if (
    event.metaKey !== expected.metaKey ||
    event.ctrlKey !== expected.ctrlKey ||
    event.altKey !== expected.altKey
  )
    return false
  if (chord.shift !== 'any' && event.shiftKey !== !!chord.shift) return false
  if (chord.key === 'digit') return (digitOf(event) ?? 0) > 0
  if (/^[0-9]$/.test(chord.key)) return digitOf(event) === Number(chord.key)
  if (/^[A-Z]$/.test(chord.key)) return letterOf(event) === chord.key
  return event.key === chord.key
}

export function matchShortcut(event: ShortcutEvent, id: ShortcutId, mac = isMacPlatform()) {
  if (event.isComposing || isAltGraph(event)) return false
  return (SHORTCUTS[id] as Chord[]).some(chord => matchesChord(event, chord, mac))
}

/** The first shortcut of `ids` the event presses. */
export function findShortcut<Id extends ShortcutId>(
  event: ShortcutEvent,
  ids: readonly Id[],
  mac = isMacPlatform()
) {
  return ids.find(id => matchShortcut(event, id, mac))
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: '↵',
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: '⌦',
  digit: '1–9',
}

/** The keys of a shortcut as printed on keycaps, in the platform's order: `['⇧', '⌘', 'K']`. */
export function shortcutKeys(id: ShortcutId, mac = isMacPlatform()) {
  const chord: Chord = SHORTCUTS[id][0]
  const keys: string[] = []
  if (mac) {
    if (chord.workspace) keys.push('⌃')
    if (chord.option) keys.push('⌥')
    if (chord.shift === true) keys.push('⇧')
    if (chord.command) keys.push('⌘')
  } else {
    if (chord.command) keys.push('Ctrl')
    if (chord.workspace || chord.option) keys.push('Alt')
    if (chord.shift === true) keys.push('⇧')
  }
  keys.push(KEY_LABELS[chord.key] ?? chord.key)
  return keys
}

/** A shortcut on one line: `⇧⌘K` on a Mac, `Ctrl+⇧K` elsewhere. */
export function formatShortcut(id: ShortcutId, mac = isMacPlatform()) {
  return shortcutKeys(id, mac)
    .map(key => (key === 'Ctrl' || key === 'Alt' ? `${key}+` : key))
    .join('')
}

export type ShortcutRow = { label: string; shortcuts: ShortcutId[] }
export type ShortcutSection = { title: string; rows: ShortcutRow[]; hint?: string }

/** What the guide and the settings page list, in this order. Labels and hints are i18n keys. */
export const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'shortcutGuide.workspace',
    rows: [
      { label: 'shortcutGuide.toggle', shortcuts: ['palette'] },
      { label: 'hotkeys.tabActions', shortcuts: ['tabActions'] },
      { label: 'shortcutGuide.newTab', shortcuts: ['newTab'] },
      { label: 'shortcutGuide.closeTab', shortcuts: ['closeTab'] },
      { label: 'shortcutGuide.previousNext', shortcuts: ['previousTab', 'nextTab'] },
      { label: 'hotkeys.recentTabs', shortcuts: ['recentTabs'] },
      { label: 'shortcutGuide.sidebar', shortcuts: ['sidebar'] },
      { label: 'shortcutGuide.guide', shortcuts: ['guide'] },
    ],
    hint: 'shortcutGuide.recentHint',
  },
  {
    title: 'shortcutGuide.bible',
    rows: [
      { label: 'shortcutGuide.chapter', shortcuts: ['previousChapter', 'nextChapter'] },
      { label: 'shortcutGuide.verseCursor', shortcuts: ['nextVerse', 'previousVerse'] },
      { label: 'shortcutGuide.extendSelection', shortcuts: ['extendNext', 'extendPrevious'] },
      { label: 'shortcutGuide.verse', shortcuts: ['goToVerse'] },
      { label: 'shortcutGuide.strong', shortcuts: ['strongMode'] },
    ],
    hint: 'shortcutGuide.bibleHint',
  },
  {
    title: 'shortcutGuide.selection',
    rows: [
      { label: 'shortcutGuide.highlight', shortcuts: ['highlight', 'removeHighlight'] },
      { label: 'Note', shortcuts: ['note'] },
      { label: 'Tag', shortcuts: ['tags'] },
      { label: 'Lien', shortcuts: ['link'] },
      { label: 'Relation', shortcuts: ['relation'] },
      { label: 'Marque-page', shortcuts: ['bookmark'] },
      { label: 'shortcutGuide.addToStudy', shortcuts: ['addToStudy'] },
      { label: 'Approfondir', shortcuts: ['focus'] },
      { label: 'Lexique', shortcuts: ['lexicon'] },
      { label: 'Dictionnaire', shortcuts: ['dictionary'] },
      { label: 'Thèmes', shortcuts: ['topics'] },
      { label: 'Références', shortcuts: ['references'] },
      { label: 'Commentaire', shortcuts: ['commentary'] },
      { label: 'Comparer', shortcuts: ['compare'] },
      { label: 'Copier', shortcuts: ['copy'] },
      { label: 'shortcutGuide.selectAll', shortcuts: ['selectAll'] },
      { label: 'shortcutGuide.deselect', shortcuts: ['deselect'] },
    ],
    hint: 'shortcutGuide.selectionHint',
  },
  {
    title: 'shortcutGuide.annotation',
    rows: [
      { label: 'Note', shortcuts: ['note'] },
      { label: 'Étiquettes', shortcuts: ['tags'] },
      { label: 'Relations', shortcuts: ['relation'] },
      { label: 'shortcutGuide.erase', shortcuts: ['erase'] },
    ],
  },
  {
    title: 'shortcutGuide.palette',
    rows: [
      { label: 'shortcutGuide.navigate', shortcuts: ['paletteUp', 'paletteDown'] },
      { label: 'shortcutGuide.select', shortcuts: ['paletteSelect'] },
      { label: 'shortcutGuide.close', shortcuts: ['paletteClose'] },
      { label: 'shortcutGuide.removeFilter', shortcuts: ['paletteRemoveFilter'] },
    ],
  },
]

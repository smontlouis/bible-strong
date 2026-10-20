/**
 * The composer field and the assistant's store, kept in step while the user types.
 *
 * The store applies a new text one task later. A field that read its value from the store
 * would render once with the previous text and push it back into the native input, losing
 * keystrokes typed quickly. The field keeps its own text instead, and only takes the store's
 * text when it comes from elsewhere: a sent message clearing it, dictation filling it.
 */
export type ComposerTextSync = {
  // The text the field last gave the store
  sentText: string
  // The texts given since the store last showed `sentText`: the store may still show one of them
  pendingTexts: string[]
}

export const createComposerTextSync = (text: string): ComposerTextSync => ({
  sentText: text,
  pendingTexts: [],
})

/** The field gives the store the text the user typed. */
export const sendComposerText = (sync: ComposerTextSync, text: string): ComposerTextSync => ({
  sentText: text,
  pendingTexts: [...sync.pendingTexts, text],
})

/**
 * The store's text changed. Returns the text the field must now show, when it comes from
 * elsewhere, and what the field still waits for.
 */
export const receiveComposerText = (
  sync: ComposerTextSync,
  storeText: string
): { sync: ComposerTextSync; fieldText?: string } => {
  if (storeText === sync.sentText) return { sync: createComposerTextSync(storeText) }
  // The store is catching up with what the user typed
  if (sync.pendingTexts.includes(storeText)) return { sync }
  return { sync: createComposerTextSync(storeText), fieldText: storeText }
}

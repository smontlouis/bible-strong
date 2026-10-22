/** Typing in a field keeps its keys. */
export function isEditingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      !!target.closest(
        'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])'
      ))
  )
}

/** Marks a popover that leaves the page usable: the keys of the page go on under it. */
export const KEYBOARD_PASSTHROUGH = 'data-keyboard-passthrough'

/**
 * A dialog or a menu takes the keys of what lies under it, except the menu beside the selected
 * verses: the workspace and the reader keep their keys while it shows.
 */
export function isBlockingOverlayOpen() {
  return [
    ...document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [aria-modal="true"]'
    ),
  ].some(element => !element.closest(`[${KEYBOARD_PASSTHROUGH}]`))
}

/** The menu beside the selected verses, or the annotation tools, shows. */
export function isPassthroughPanelOpen() {
  return !!document.querySelector(`[${KEYBOARD_PASSTHROUGH}]`)
}

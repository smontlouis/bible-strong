export const dispatch = (obj) => {
  window.postMessage(JSON.stringify(obj))
}

export const SEND_INITIAL_DATA = 'SEND_INITIAL_DATA'
export const SEND_HIGHLIGHTED_VERSES = 'SEND_HIGHLIGHTED_VERSES'

export const NAVIGATE_TO_BIBLE_VERSE_DETAIL = 'NAVIGATE_TO_BIBLE_VERSE_DETAIL'
export const TOGGLE_SELECTED_VERSE = 'TOGGLE_SELECTED_VERSE'

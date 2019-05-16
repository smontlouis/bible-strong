export const dispatch = (obj) => {
  window.postMessage(JSON.stringify(obj))
}

export const NAVIGATE_TO_BIBLE_VERSE_DETAIL = 'NAVIGATE_TO_BIBLE_VERSE_DETAIL'

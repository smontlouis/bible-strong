export const dispatch = obj => {
  if (!window.ReactNativeWebView) {
    window.ReactNativeWebView = window.ReactABI33_0_0NativeWebView || { postMessage() {} }
  }
  window.ReactNativeWebView.postMessage(JSON.stringify(obj))
}

export const SEND_INITIAL_DATA = 'SEND_INITIAL_DATA'

export const NAVIGATE_TO_BIBLE_VIEW = 'NAVIGATE_TO_BIBLE_VIEW'
export const NAVIGATE_TO_BIBLE_NOTE = 'NAVIGATE_TO_BIBLE_NOTE'
export const NAVIGATE_TO_BIBLE_VERSE_DETAIL = 'NAVIGATE_TO_BIBLE_VERSE_DETAIL'
export const NAVIGATE_TO_VERSE_NOTES = 'NAVIGATE_TO_VERSE_NOTES'
export const NAVIGATE_TO_STRONG = 'NAVIGATE_TO_STRONG'
export const TOGGLE_SELECTED_VERSE = 'TOGGLE_SELECTED_VERSE'
export const CONSOLE_LOG = 'CONSOLE_LOG'
export const THROW_ERROR = 'THROW_ERROR'

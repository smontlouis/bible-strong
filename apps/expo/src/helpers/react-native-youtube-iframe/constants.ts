export const PLAYER_STATES: Record<string, string> = {
  '-1': 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'video cued',
}

export const PLAYER_ERROR: Record<string, string> = {
  2: 'invalid_parameter',
  5: 'HTML5_error',
  100: 'video_not_found',
  101: 'embed_not_allowed',
  150: 'embed_not_allowed',
}

// YouTube refuses an embed whose request names no app in its Referer (error 153). The player page
// takes this origin from the WebView base URL; its host is the app's store identifier.
export const PLAYER_ORIGIN = 'https://com.smontlouis.biblestrong'
export const PLAYER_BASE_URL = `${PLAYER_ORIGIN}/`

export const CUSTOM_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'

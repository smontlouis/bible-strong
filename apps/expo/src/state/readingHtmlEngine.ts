import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { HtmlEngine } from '~common/readingHtml'

/** Device-local rendering preference; explicit component engine props take priority. */
export const readingHtmlEngineAtom = atomWithAsyncStorage<HtmlEngine>(
  'reading-html-engine-v1',
  'native',
  {
    migrate: value => (value === 'dom' ? 'dom' : 'native'),
  }
)

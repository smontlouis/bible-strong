import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'
import {
  parseInlineCommentaries,
  serializeInlineCommentaries,
} from '../bible/bibleCommentaries'
import { isTrackingParameter } from './pageDelivery'

// A page is kept under its address with its parameters (ADR-0084): a parameter no page reads
// would make another copy of the page, rendered again from the Resource API, for every value
// a crawler tries. The gateway sends a read with such a parameter to the same page without it.

/** The parameters each family of pages reads, by the address of the page. */
const READ_PARAMETERS: readonly { path: RegExp; names: readonly string[] }[] = [
  // `?commentary=barnes.mhy-fr`: the commentaries shown in the text of a passage.
  { path: /^\/bible\/[^/]+\/.+$/u, names: ['commentary'] },
  // `?book=jhn`: the verses of one book in a concordance.
  { path: /^\/strong\/[^/]+\/[^/]+\/concordance(?:\/[^/]+)?$/u, names: ['book'] },
  // `?page=2`: a commentary chapter, or the articles of a dictionary letter, too long for one page.
  { path: /^\/commentary\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/u, names: ['page'] },
  { path: /^\/dictionary\/[^/]+\/(?!term\/)[^/]+\/[^/]+$/u, names: ['page'] },
  // `?p=audibible`: the donation page as the Audibible application opens it.
  { path: /^\/(?:fr\/)?give$/u, names: ['p'] },
]

/**
 * Answered without a page, with parameters of their own or none that matter: server
 * functions (`?payload=`), share images.
 */
const UNCHECKED_PATHS = /^\/(?:_serverFn|share-card)(?:\/|$)/u

const COMMENTARY_PARAMETER = 'commentary'

const decodeComponent = (text: string): string | undefined => {
  try {
    return decodeURIComponent(text.replace(/\+/gu, ' '))
  } catch {
    return undefined
  }
}

/**
 * The commentaries the values of `commentary` name, as the address of a Bible page writes
 * them: the catalog commentaries only, each once, in their one order. An unknown name shows
 * nothing on the page, and would carry on to every page it links to.
 */
export const knownInlineCommentaries = (values: readonly string[]): string | undefined =>
  serializeInlineCommentaries(
    parseInlineCommentaries(
      values
        .flatMap(value => value.split(/[.,]/u))
        .filter(id => COMMENTARY_CATALOG_BY_ID.has(id))
    )
  )

/**
 * Where a read with a parameter its page does not read is sent: the same address with only
 * the parameters it reads, in their order and as written, and the ones a sharer adds to a
 * link, which the key of a kept page already leaves out. The commentaries of a Bible page
 * are written in their one spelling. Nothing when the address is already so.
 */
export const addressWithReadParameters = (url: URL): string | undefined => {
  if (!url.search || UNCHECKED_PATHS.test(url.pathname)) return undefined
  const read = READ_PARAMETERS.find(family => family.path.test(url.pathname))?.names ?? []

  const kept: string[] = []
  const commentaries: string[] = []
  let commentaryAt: number | undefined
  let changed = false
  for (const pair of url.search.slice(1).split('&')) {
    // An empty pair names nothing, and the key of a page does not see it.
    if (!pair) continue
    const separator = pair.indexOf('=')
    const name = decodeComponent(separator === -1 ? pair : pair.slice(0, separator))
    if (name === COMMENTARY_PARAMETER && read.includes(COMMENTARY_PARAMETER)) {
      commentaries.push(separator === -1 ? '' : (decodeComponent(pair.slice(separator + 1)) ?? ''))
      if (commentaryAt === undefined) {
        commentaryAt = kept.length
        kept.push(pair)
      }
    } else if (name !== undefined && (read.includes(name) || isTrackingParameter(name))) {
      kept.push(pair)
    } else {
      changed = true
    }
  }

  if (commentaryAt !== undefined) {
    const commentary = knownInlineCommentaries(commentaries)
    if (commentaries.length > 1 || commentaries[0] !== commentary) changed = true
    if (commentary) kept[commentaryAt] = `${COMMENTARY_PARAMETER}=${commentary}`
    else kept.splice(commentaryAt, 1)
  }

  if (!changed) return undefined
  return `${url.origin}${url.pathname}${kept.length ? `?${kept.join('&')}` : ''}`
}

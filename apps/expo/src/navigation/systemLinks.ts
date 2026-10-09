// A link to the public site, handed over by the system, opens the application when it is
// installed (ADR-0082). The site and the application do not have the same pages: this says
// where each address of the site leads inside the application.

const PUBLIC_SITE_HOST = 'bible-strong.app'

/** The screen showing a page of the site the application has no screen for. */
export const SITE_PAGE_ROUTE = '/site-page'

const STRONG_CODE = '[hg]\\d+[a-z]*'

// The site names the language of a Strong entry in its address; the application reads the
// entry in the language of its own lexicon. The pages of a concordance are one screen here.
const SITE_STRONG_PAGE = new RegExp(
  `^/strong/(?:fr|en)/(${STRONG_CODE})(?:(/concordance)(?:/\\d+)?)?$`,
  'iu'
)

// The pages of the site the application shows with a screen of its own. The lists and the
// indexes of the site (a lexicon by letter, the books of a version…) are not among them.
// Kept in step with the paths the site announces to iOS (`apps/site/features/appLinks`).
const APP_PAGES = [
  // `/bible/:version[/:presentation[/:language]]/:book/:chapter[/:passage]`
  /^\/bible(?:\/[^/]+){3,6}$/u,
  new RegExp(`^/strong/${STRONG_CODE}(?:/(?:concordance|dictionary|related))?$`, 'iu'),
  /^\/dictionary\/(?:fr|en)(?:\/[^/]+){3}$/u,
  /^\/nave\/(?:fr|en)\/(?!index$)[^/]+$/u,
  /^\/commentary\/(?:fr|en)\/[^/]+\/[^/]+\/\d+(?:\/[^/]+)?$/u,
  /^\/timeline\/(?:fr|en)(?:\/[^/]+)?$/u,
]

// Read by hand: what the system hands over is not always a well-formed address.
const SYSTEM_LINK = /^(?:([a-z][a-z0-9+.-]*):\/\/([^/?#]*))?([^?#]*)(\?[^#]*)?/iu

const strongRoute = (pathname: string): string | undefined => {
  const match = SITE_STRONG_PAGE.exec(pathname)
  return match ? `/strong/${match[1]}${match[2] ? '/concordance' : ''}` : undefined
}

/**
 * Where a link handed over by the system leads. A page of the site the application has no
 * screen for is shown as the site draws it, so that no link ends on a missing screen. Any
 * other link (the scheme of the application, a development client) is left as it came.
 */
export const resolveSystemPath = (link: string): string => {
  const [, scheme, host, rawPathname = '', search = ''] = SYSTEM_LINK.exec(link) ?? []
  const pathname = rawPathname.replace(/\/+$/u, '')

  if (!scheme) return strongRoute(pathname) ?? link
  if (!/^https?$/iu.test(scheme) || host?.toLowerCase() !== PUBLIC_SITE_HOST) return link

  if (!pathname) return '/'
  const strong = strongRoute(pathname)
  if (strong) return strong
  if (APP_PAGES.some(page => page.test(pathname))) return `${pathname}${search}`
  return `${SITE_PAGE_ROUTE}?path=${encodeURIComponent(`${pathname}${search}`)}`
}

/** The address of a page of the site, from the path the screen was opened with. */
export const sitePageUrl = (path: string | undefined): string | undefined =>
  path && /^\/(?!\/)/u.test(path) ? `https://${PUBLIC_SITE_HOST}${path}` : undefined

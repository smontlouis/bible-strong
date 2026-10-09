// A link to a resource of this site opens the application when it is installed (ADR-0082).
// The two documents below tell iOS and Android which application may open which page; each
// system reads its own at `/.well-known/`.

// The team and the bundle of the application on the App Store.
const IOS_APP_ID = '7PZMKGJ67J.com.smontlouis.biblestrong'

const ANDROID_PACKAGE = 'com.smontlouis.biblestrong'
const ANDROID_CERTIFICATES = [
  // The key Google Play signs the published application with.
  'DB:63:C5:F5:05:0B:C3:8C:0E:84:EC:84:F8:D7:B3:6D:12:82:5F:EF:0E:32:49:4E:1E:93:53:5D:D4:A1:46:41',
  // The key builds are signed with before Google Play: a build installed without the store.
  '7F:DE:9F:23:CB:55:71:FA:A8:82:2D:51:0A:CB:E4:7F:C9:6C:A3:9D:0B:04:B6:94:EA:35:64:2F:3A:D1:BA:A8',
]

type AppLinkComponent = { '/': string; exclude?: true; comment: string }

/**
 * The pages iOS opens in the application: the resources it has a screen for. The first
 * component a path matches decides; `*` stands for any characters, slashes included, and
 * `?` for exactly one. Lists and indexes stay in the browser, like the home page, the legal
 * pages and shared studies. Kept in step with the screens the application has
 * (`apps/expo/src/navigation/systemLinks.ts`).
 */
export const APP_LINK_COMPONENTS: AppLinkComponent[] = [
  { '/': '/bible/?*/?*/?*', comment: 'A chapter or a passage, in any presentation' },
  { '/': '/strong/fr', exclude: true, comment: 'The home of the lexicon' },
  { '/': '/strong/en', exclude: true, comment: 'The home of the lexicon' },
  { '/': '/strong/*/hebrew/*', exclude: true, comment: 'The lexicon by letter' },
  { '/': '/strong/*/greek/*', exclude: true, comment: 'The lexicon by letter' },
  { '/': '/strong/?*', comment: 'A Strong entry and its concordance' },
  { '/': '/dictionary/?*/?*/?*/?*', comment: 'A dictionary entry' },
  { '/': '/nave/*/index', exclude: true, comment: 'The topics by letter' },
  { '/': '/nave/*/index/*', exclude: true, comment: 'The topics by letter' },
  { '/': '/nave/?*/?*', comment: 'A topic' },
  { '/': '/commentary/?*/?*/?*/?*', comment: 'A commentary on a chapter or one of its sections' },
  { '/': '/timeline/?*', comment: 'The timeline and its events' },
]

export const appleAppSiteAssociation = {
  applinks: {
    details: [{ appIDs: [IOS_APP_ID], components: APP_LINK_COMPONENTS }],
  },
}

// Android has no list of paths here: the application declares the families it opens.
export const androidAssetLinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE,
      sha256_cert_fingerprints: ANDROID_CERTIFICATES,
    },
  },
]

// Both systems ask for JSON served as such, without a redirect. They keep their own copy for
// a day or more; an hour here only spares the function.
export const appLinkResponse = (document: unknown): Response =>
  new Response(JSON.stringify(document), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })

const escapeRegExp = (value: string) => value.replace(/[.+^${}()|[\]\\]/gu, '\\$&')

const componentPattern = (component: string): RegExp =>
  new RegExp(
    `^${component
      .split(/([*?])/u)
      .map(part => (part === '*' ? '.*' : part === '?' ? '.' : escapeRegExp(part)))
      .join('')}$`,
    'u'
  )

/** Whether iOS opens a path of the site in the application, as its first-match rule reads the list. */
export const opensInApplication = (path: string): boolean => {
  const match = APP_LINK_COMPONENTS.find(component => componentPattern(component['/']).test(path))
  return !!match && !match.exclude
}

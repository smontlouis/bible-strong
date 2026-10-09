import { resolveSystemPath, sitePageUrl } from '../systemLinks'

const site = (path: string) => `https://bible-strong.app${path}`
const sitePage = (path: string) => `/site-page?path=${encodeURIComponent(path)}`

describe('resolveSystemPath', () => {
  it.each([
    ['/bible/lsg/gen/1'],
    ['/bible/lsg/jhn/3/16'],
    ['/bible/lsg/jhn/3/16-18'],
    ['/bible/kjv/strong/gen/1'],
    ['/bible/bhg/interlinear/fr/gen/1/1'],
    ['/dictionary/fr/bym/1234/abraham'],
    ['/nave/fr/abraham'],
    ['/commentary/fr/mhy-fr/gen/1'],
    ['/commentary/fr/mhy-fr/gen/1/section-3'],
    ['/timeline/fr'],
    ['/timeline/en/abraham-born'],
  ])('opens %s on the screen of the same address', path => {
    expect(resolveSystemPath(site(path))).toBe(path)
  })

  it('reads a Strong entry in the lexicon of the application, whatever the language of the link', () => {
    expect(resolveSystemPath(site('/strong/fr/g26'))).toBe('/strong/g26')
    expect(resolveSystemPath(site('/strong/en/h0430a'))).toBe('/strong/h0430a')
    expect(resolveSystemPath(site('/strong/g26'))).toBe('/strong/g26')
  })

  it('opens any page of a concordance on the concordance screen', () => {
    expect(resolveSystemPath(site('/strong/fr/g26/concordance'))).toBe('/strong/g26/concordance')
    expect(resolveSystemPath(site('/strong/fr/g26/concordance/3'))).toBe('/strong/g26/concordance')
  })

  it('keeps the options of a page and drops its anchor and its trailing slash', () => {
    expect(resolveSystemPath(site('/bible/kjv/reverse-interlinear/gen/1?gloss=fr#v3'))).toBe(
      '/bible/kjv/reverse-interlinear/gen/1?gloss=fr'
    )
    expect(resolveSystemPath(site('/timeline/fr/'))).toBe('/timeline/fr')
  })

  it('opens the home of the site on the home of the application', () => {
    expect(resolveSystemPath('https://bible-strong.app')).toBe('/')
    expect(resolveSystemPath('https://bible-strong.app/')).toBe('/')
  })

  it.each([
    ['/bible'],
    ['/bible/lsg'],
    ['/strong/fr'],
    ['/strong/fr/greek/a'],
    ['/dictionary/fr'],
    ['/dictionary/fr/bym/a'],
    ['/dictionary/fr/term/abraham'],
    ['/nave/fr'],
    ['/nave/fr/index'],
    ['/nave/fr/index/a/2'],
    ['/commentary/fr'],
    ['/commentary/fr/mhy-fr'],
    ['/studies/abc123'],
    ['/fr/give'],
    ['/privacy-policy'],
  ])('shows %s as the site draws it, having no screen for it', path => {
    expect(resolveSystemPath(site(path))).toBe(sitePage(path))
  })

  it('leaves every other link as it came', () => {
    expect(resolveSystemPath('biblestrong://strong/g26')).toBe('biblestrong://strong/g26')
    expect(resolveSystemPath('https://example.com/strong/fr/g26')).toBe(
      'https://example.com/strong/fr/g26'
    )
    expect(resolveSystemPath('/bookmarks')).toBe('/bookmarks')
    expect(resolveSystemPath('')).toBe('')
  })

  it('rewrites a Strong address of the site even when the system hands over a bare path', () => {
    expect(resolveSystemPath('/strong/fr/g26')).toBe('/strong/g26')
  })
})

describe('sitePageUrl', () => {
  it('names a page of the site and nothing else', () => {
    expect(sitePageUrl('/studies/abc123')).toBe('https://bible-strong.app/studies/abc123')
    expect(sitePageUrl('//example.com')).toBeUndefined()
    expect(sitePageUrl('https://example.com')).toBeUndefined()
    expect(sitePageUrl(undefined)).toBeUndefined()
  })
})

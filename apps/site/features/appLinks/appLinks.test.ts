import { describe, expect, it } from 'vitest'
import {
  androidAssetLinks,
  appLinkResponse,
  appleAppSiteAssociation,
  opensInApplication,
} from './appLinks'

describe('Pages a link opens in the application', () => {
  it.each([
    '/bible/lsg/gen/1',
    '/bible/lsg/jhn/3/16',
    '/bible/lsg/jhn/3/16-18',
    '/bible/kjv/strong/gen/1',
    '/bible/bhg/interlinear/fr/gen/1/1',
    '/strong/fr/g26',
    '/strong/en/h0430a',
    '/strong/fr/g26/concordance',
    '/strong/fr/g26/concordance/3',
    '/dictionary/fr/bym/1234/abraham',
    '/nave/fr/abraham',
    '/commentary/fr/mhy-fr/gen/1',
    '/commentary/fr/mhy-fr/gen/1/section-3',
    '/timeline/fr',
    '/timeline/en/abraham-born',
  ])('opens %s, a resource the application has a screen for', path => {
    expect(opensInApplication(path)).toBe(true)
  })

  it.each([
    '/',
    '/fr',
    '/bible',
    '/bible/lsg',
    '/bible/lsg/gen',
    '/strong/fr',
    '/strong/en',
    '/strong/fr/greek/a',
    '/strong/en/hebrew/b',
    '/dictionary/fr',
    '/dictionary/fr/bym',
    '/dictionary/fr/bym/a',
    '/dictionary/fr/term/abraham',
    '/nave/fr',
    '/nave/fr/index',
    '/nave/fr/index/a',
    '/nave/fr/index/a/2',
    '/commentary/fr',
    '/commentary/fr/mhy-fr',
    '/timeline',
    '/studies/abc123',
    '/fr/give',
    '/privacy-policy',
    '/share-card/abc',
    '/sitemap.xml',
  ])('leaves %s in the browser', path => {
    expect(opensInApplication(path)).toBe(false)
  })
})

describe('Documents the systems read', () => {
  it('names the application of the App Store to iOS', () => {
    expect(appleAppSiteAssociation.applinks.details[0]?.appIDs).toEqual([
      '7PZMKGJ67J.com.smontlouis.biblestrong',
    ])
  })

  it('names the package and the certificates of the application to Android', () => {
    const [statement] = androidAssetLinks
    expect(statement?.relation).toEqual(['delegate_permission/common.handle_all_urls'])
    expect(statement?.target.package_name).toBe('com.smontlouis.biblestrong')
    expect(statement?.target.sha256_cert_fingerprints).toHaveLength(2)
    for (const fingerprint of statement?.target.sha256_cert_fingerprints ?? []) {
      expect(fingerprint).toMatch(/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/u)
    }
  })

  it('is served as JSON', async () => {
    const response = appLinkResponse(androidAssetLinks)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(await response.json()).toEqual(androidAssetLinks)
  })
})

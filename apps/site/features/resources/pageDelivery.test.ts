import { describe, expect, it } from 'vitest'
import {
  addressWithoutEndSlash,
  deliveredPage,
  MISSING_PAGE_CACHE_CONTROL,
  pageCacheKey,
  pageCacheTags,
  permanentMove,
  readPageRefresh,
  withSecurityHeaders,
} from './pageDelivery'

const key = (address: string, buildRevision = 'build1') =>
  pageCacheKey(new URL(address, 'https://bible-strong.app'), buildRevision)

describe('Key a page is kept under', () => {
  it('carries the revision of the build and the address of the page', () => {
    expect(key('/bible/lsg/gen/1')).toBe('build1:/bible/lsg/gen/1')
    expect(key('/')).toBe('build1:/')
  })

  it('starts anew with another build, and keeps its pages with the same one', () => {
    expect(key('/bible/lsg/gen/1', 'build2')).not.toBe(key('/bible/lsg/gen/1'))
    expect(key('/bible/lsg/gen/1', 'build1')).toBe(key('/bible/lsg/gen/1'))
  })

  it('tells pages apart by the options that change them', () => {
    expect(key('/bible/lsg/gen/1?commentary=barnes')).toBe('build1:/bible/lsg/gen/1?commentary=barnes')
    expect(key('/bible/kjv/reverse-interlinear/gen/1?gloss=fr')).not.toBe(
      key('/bible/kjv/reverse-interlinear/gen/1?gloss=en')
    )
  })

  it('keeps one copy of a page whatever a sharer added to its link', () => {
    expect(key('/bible/lsg/gen/1?utm_source=newsletter&utm_campaign=x&fbclid=abc')).toBe(
      key('/bible/lsg/gen/1')
    )
    expect(key('/bible/lsg/gen/1?gclid=1&commentary=barnes')).toBe(
      key('/bible/lsg/gen/1?commentary=barnes')
    )
  })
})

describe('Address written with a slash at its end', () => {
  const moved = (address: string) =>
    addressWithoutEndSlash(new URL(address, 'https://bible-strong.app'))

  it('is read without the slash, with what it asked', () => {
    expect(moved('/fr/')).toBe('https://bible-strong.app/fr')
    expect(moved('/bible/lsg/gen/1/')).toBe('https://bible-strong.app/bible/lsg/gen/1')
    expect(moved('/strong/en/g5048/?book=acts')).toBe(
      'https://bible-strong.app/strong/en/g5048?book=acts'
    )
    expect(moved('/fr///')).toBe('https://bible-strong.app/fr')
  })

  it.each(['/', '/fr', '/bible/lsg/gen/1', '/strong/en/g5048?next=/fr/'])(
    'leaves %s where it is',
    address => {
      expect(moved(address)).toBeUndefined()
    }
  )

  it('never leads out of the site', () => {
    expect(addressWithoutEndSlash(new URL('https://bible-strong.app//example.com/'))).toBe(
      'https://bible-strong.app//example.com'
    )
  })
})

describe('Tags a kept page is found again by', () => {
  it('names every page, and each of the first folders of its address', () => {
    expect(pageCacheTags('/bible/lsg/gen/1/16')).toEqual([
      'page',
      'path:bible',
      'path:bible/lsg',
      'path:bible/lsg/gen',
    ])
    expect(pageCacheTags('/')).toEqual(['page'])
  })

  it('stops at a folder a tag cannot name', () => {
    expect(pageCacheTags('/dictionary/fr/été/1')).toEqual(['page', 'path:dictionary', 'path:dictionary/fr'])
    expect(pageCacheTags('/a,b/c')).toEqual(['page'])
  })
})

describe('What a rendered answer is sent with', () => {
  const kept = 'public, max-age=0, s-maxage=2592000, stale-while-revalidate=604800'

  it('tags an answer its route asked to be kept', () => {
    const delivered = deliveredPage(
      new Response('page', { headers: { 'cache-control': kept } }),
      '/strong/fr/g0026'
    )
    expect(delivered.headers.get('cache-control')).toBe(kept)
    expect(delivered.headers.get('cache-tag')).toBe('page,path:strong,path:strong/fr,path:strong/fr/g0026')
  })

  it('marks as the reader’s own an answer that says nothing about its keeping', () => {
    const delivered = deliveredPage(new Response('home'), '/fr')
    expect(delivered.headers.get('cache-control')).toBe('private')
    expect(delivered.headers.has('cache-tag')).toBe(false)
  })

  it.each(['public, max-age=3600', 'private, s-maxage=60', 'no-store'])(
    'leaves "%s" as it is, without a tag',
    cacheControl => {
      const delivered = deliveredPage(
        new Response('x', { headers: { 'cache-control': cacheControl } }),
        '/bible'
      )
      expect(delivered.headers.get('cache-control')).toBe(cacheControl)
      expect(delivered.headers.has('cache-tag')).toBe(false)
    }
  )

  it('keeps the status and the body of the answer', async () => {
    const delivered = deliveredPage(new Response('gone', { status: 404 }), '/nope')
    expect(delivered.status).toBe(404)
    expect(await delivered.text()).toBe('gone')
  })

  it('keeps a permanent move like a page, with its tags', () => {
    const delivered = deliveredPage(
      new Response(null, { status: 301, headers: { location: '/strong/fr/h0001' } }),
      '/strong/fr/h1'
    )
    expect(delivered.headers.get('cache-control')).toBe(kept)
    expect(delivered.headers.get('cache-tag')).toBe('page,path:strong,path:strong/fr,path:strong/fr/h1')
    expect(delivered.headers.get('location')).toBe('/strong/fr/h0001')
  })

  it('keeps a missing page an hour, with its tags', () => {
    const delivered = deliveredPage(new Response('missing', { status: 404 }), '/bible/lsg/gen/99')
    expect(delivered.headers.get('cache-control')).toBe(MISSING_PAGE_CACHE_CONTROL)
    expect(delivered.headers.get('cache-tag')).toBe('page,path:bible,path:bible/lsg,path:bible/lsg/gen')
  })

  it('keeps a minute a move or a missing page decided from a STALE answer', () => {
    for (const status of [301, 404]) {
      const delivered = deliveredPage(
        new Response(null, { status, headers: { 'x-page-stale': '1' } }),
        '/strong/fr/h1'
      )
      expect(delivered.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60')
    }
  })

  it.each([
    [500, '/bible/lsg/gen/1'],
    [503, '/bible/lsg/gen/1'],
    [302, '/bible/lsg/gen/1'],
    [404, '/studies/abc'],
    [404, '/fr/studies/abc'],
    [301, '/_serverFn/abc'],
  ])('keeps no %i answer for %s', (status, pathname) => {
    const delivered = deliveredPage(new Response(null, { status }), pathname)
    expect(delivered.headers.get('cache-control')).toBe('private')
    expect(delivered.headers.has('cache-tag')).toBe(false)
  })

  it('leaves a missing page its route says how to keep', () => {
    const delivered = deliveredPage(
      new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } }),
      '/bible'
    )
    expect(delivered.headers.get('cache-control')).toBe('no-store')
  })
})

describe('What every answer is sent with', () => {
  it('adds the security headers', () => {
    const secured = withSecurityHeaders(new Response('page'))
    expect(secured.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains'
    )
    expect(secured.headers.get('x-content-type-options')).toBe('nosniff')
    expect(secured.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(secured.headers.get('content-security-policy')).toBe("frame-ancestors 'self'")
    expect(secured.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })

  it('keeps what an answer sets itself, and works on an answer whose headers cannot change', async () => {
    const secured = withSecurityHeaders(
      new Response('image', { status: 200, headers: { 'referrer-policy': 'no-referrer' } })
    )
    expect(secured.headers.get('referrer-policy')).toBe('no-referrer')
    expect(await secured.text()).toBe('image')
    const moved = withSecurityHeaders(Response.redirect('https://bible-strong.app/fr', 301))
    expect(moved.status).toBe(301)
    expect(moved.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('sends a permanent move the reader keeps a day', () => {
    const move = permanentMove('https://bible-strong.app/bible/lsg/gen/1')
    expect(move.status).toBe(301)
    expect(move.headers.get('location')).toBe('https://bible-strong.app/bible/lsg/gen/1')
    expect(move.headers.get('cache-control')).toBe('public, max-age=86400')
  })
})

describe('Pages the operator asks to be rendered again', () => {
  it('reads everything, or the pages under some folders', () => {
    expect(readPageRefresh({ everything: true })).toEqual({ everything: true })
    expect(readPageRefresh({ paths: ['/bible/lsg/', 'strong'] })).toEqual({
      tags: ['path:bible/lsg', 'path:strong', 'path:_serverFn'],
    })
  })

  it.each([undefined, null, 'x', {}, { paths: [] }, { paths: ['/'] }, { paths: [3] }, { everything: 'yes' }])(
    'refuses %j',
    body => {
      expect(readPageRefresh(body)).toBeUndefined()
    }
  )
})

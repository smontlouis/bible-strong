import { describe, expect, it } from 'vitest'
import {
  deliveredPage,
  pageCacheKey,
  pageCacheTags,
  readPageRefresh,
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
})

describe('Pages the operator asks to be rendered again', () => {
  it('reads everything, or the pages under some folders', () => {
    expect(readPageRefresh({ everything: true })).toEqual({ everything: true })
    expect(readPageRefresh({ paths: ['/bible/lsg/', 'strong'] })).toEqual({
      tags: ['path:bible/lsg', 'path:strong'],
    })
  })

  it.each([undefined, null, 'x', {}, { paths: [] }, { paths: ['/'] }, { paths: [3] }, { everything: 'yes' }])(
    'refuses %j',
    body => {
      expect(readPageRefresh(body)).toBeUndefined()
    }
  )
})

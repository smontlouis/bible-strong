import {
  FIREBASE_APP_CHECK_HEADER,
  createResourceAppCheckFetch,
  getResourceAppCheckHeaders,
} from '../resourceAppCheckRequest'

describe('Resource App Check requests', () => {
  it('attaches an App Check token to every protected production Resource API request', async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(() =>
      Promise.resolve(new Response('{}', { status: 200 }))
    )
    const getToken = jest.fn(async () => 'attestation-token')
    const guardedFetch = createResourceAppCheckFetch(fetcher, getToken)

    await guardedFetch(
      'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip',
      {
        headers: { accept: 'application/zip' },
      }
    )
    await guardedFetch('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
      headers: { accept: 'application/json' },
    })
    await guardedFetch('https://api.bible-strong.app/v1/offline-catalog')
    await guardedFetch('http://127.0.0.1:8787/health')

    const guardedHeaders = fetcher.mock.calls[0]?.[1]?.headers
    expect(new Headers(guardedHeaders).get(FIREBASE_APP_CHECK_HEADER)).toBe('attestation-token')
    expect(new Headers(guardedHeaders).get('accept')).toBe('application/zip')
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get(FIREBASE_APP_CHECK_HEADER)).toBe(
      'attestation-token'
    )
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('accept')).toBe('application/json')
    expect(fetcher.mock.calls[2]).toEqual([
      'https://api.bible-strong.app/v1/offline-catalog',
      undefined,
    ])
    expect(fetcher.mock.calls[3]).toEqual(['http://127.0.0.1:8787/health', undefined])
    expect(getToken).toHaveBeenCalledTimes(2)
  })

  it('refreshes the token once after an authenticated GET is rejected', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const getToken = jest.fn(async (forceRefresh = false) =>
      forceRefresh ? 'fresh-token' : 'cached-token'
    )

    const response = await createResourceAppCheckFetch(
      fetcher,
      getToken
    )('https://api.bible-strong.app/v1/offline-artifacts/databases/nave-fr.sqlite.zip')

    expect(response.status).toBe(200)
    expect(getToken.mock.calls).toEqual([[false], [true]])
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get(FIREBASE_APP_CHECK_HEADER)).toBe(
      'fresh-token'
    )
  })

  it('provides App Check headers for protected API and artifact URLs only', async () => {
    const getToken = jest.fn(async () => 'download-token')

    await expect(
      getResourceAppCheckHeaders(
        'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip',
        getToken
      )
    ).resolves.toEqual({ [FIREBASE_APP_CHECK_HEADER]: 'download-token' })
    await expect(
      getResourceAppCheckHeaders(
        'https://api.bible-strong.app/v1/bibles/LSG/chapters/1/1',
        getToken
      )
    ).resolves.toEqual({ [FIREBASE_APP_CHECK_HEADER]: 'download-token' })
    await expect(
      getResourceAppCheckHeaders('https://api.bible-strong.app/v1/offline-catalog', getToken)
    ).resolves.toEqual({})
  })

  it('applies the request deadline while waiting for an App Check token', async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    const getToken = jest.fn(() => new Promise<string>(() => undefined))
    const guardedFetch = createResourceAppCheckFetch(fetcher, getToken, { timeoutMs: 5 })

    await expect(
      guardedFetch('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1')
    ).rejects.toThrow('RESOURCE_REQUEST_TIMEOUT')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('cancels token acquisition when the caller aborts', async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    const getToken = jest.fn(() => new Promise<string>(() => undefined))
    const controller = new AbortController()
    const guardedFetch = createResourceAppCheckFetch(fetcher, getToken, { timeoutMs: 60_000 })

    const request = guardedFetch('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
      signal: controller.signal,
    })
    controller.abort()

    await expect(request).rejects.toThrow('RESOURCE_REQUEST_ABORTED')
    expect(fetcher).not.toHaveBeenCalled()
  })
})

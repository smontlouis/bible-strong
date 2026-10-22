import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import YoutubeIframe from '../YoutubeIframe'
import { PLAYER_BASE_URL, PLAYER_ORIGIN } from '../constants'

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: { ios?: unknown }) => options.ios },
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
}))
jest.mock('react-native-webview', () => ({ __esModule: true, default: 'WebView' }))
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: 'Box' }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: 'Text' }))

type WebViewProps = {
  source: { html: string; baseUrl?: string }
  onShouldStartLoadWithRequest: (request: { url: string; mainDocumentURL?: string }) => boolean
}

const webViewProps = (renderer: ReactTestRenderer) =>
  renderer.root.findByType('WebView' as React.ElementType).props as WebViewProps

describe('YoutubeIframe', () => {
  let renderer: ReactTestRenderer
  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })
  beforeEach(() => {
    act(() => {
      renderer = create(<YoutubeIframe videoId="6CByTcTzbKI" height={200} />)
    })
  })
  afterEach(() => act(() => renderer.unmount()))

  // Without an origin the embed sends no Referer, and YouTube answers with error 153.
  it('gives the player page an https origin named after the app', () => {
    const { source } = webViewProps(renderer)
    expect(source.baseUrl).toBe(PLAYER_BASE_URL)
    expect(PLAYER_BASE_URL).toBe('https://com.smontlouis.biblestrong/')
    expect(source.html).toContain(
      '<meta name="referrer" content="strict-origin-when-cross-origin">'
    )
    expect(source.html).toContain(`origin: '${PLAYER_ORIGIN}'`)
    expect(source.html).toContain(`widget_referrer: '${PLAYER_ORIGIN}'`)
  })

  // YouTube answers an empty `list` with error 150, as if the video refused embedding.
  it('names a playlist only when there is one', () => {
    expect(webViewProps(renderer).source.html).toContain('listType: undefined,')
    expect(webViewProps(renderer).source.html).toContain('list: undefined,')
    act(() => renderer.update(<YoutubeIframe playList="PLabc" height={200} />))
    expect(webViewProps(renderer).source.html).toContain("listType: 'playlist',")
    expect(webViewProps(renderer).source.html).toContain("list: 'PLabc',")
  })

  it('loads the player page and its frames, and nothing else in its place', () => {
    const { onShouldStartLoadWithRequest } = webViewProps(renderer)
    expect(
      onShouldStartLoadWithRequest({ url: PLAYER_BASE_URL, mainDocumentURL: PLAYER_BASE_URL })
    ).toBe(true)
    expect(
      onShouldStartLoadWithRequest({
        url: 'https://www.youtube.com/embed/6CByTcTzbKI',
        mainDocumentURL: PLAYER_BASE_URL,
      })
    ).toBe(true)
    expect(
      onShouldStartLoadWithRequest({
        url: 'https://www.youtube.com/watch?v=6CByTcTzbKI',
        mainDocumentURL: 'https://www.youtube.com/watch?v=6CByTcTzbKI',
      })
    ).toBe(false)
    expect(
      onShouldStartLoadWithRequest({ url: 'about:blank', mainDocumentURL: 'about:blank' })
    ).toBe(false)
  })
})

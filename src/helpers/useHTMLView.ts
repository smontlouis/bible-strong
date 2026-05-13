import { useTheme } from '@emotion/react'
import { useRef } from 'react'
import literata from '~assets/fonts/literata'
import { Theme } from '~themes'
import * as Sentry from '@sentry/react-native'
import WebView from 'react-native-webview'
import {
  WebViewMessageEvent,
  WebViewRenderProcessGoneEvent,
  WebViewTerminatedEvent,
} from 'react-native-webview/lib/WebViewTypes'

const fontRule = `@font-face { font-family: 'Literata Book'; src: local('Literata Book'), url('${literata}') format('woff');}`

export type HTMLViewLinkPayload = {
  href: string
  content: string
  type: string
}

type HTMLViewMessage =
  | {
      type: 'link'
      payload: HTMLViewLinkPayload
    }
  | {
      type: string
      payload?: unknown
    }

const isHTMLViewLinkPayload = (payload: unknown): payload is HTMLViewLinkPayload =>
  typeof payload === 'object' &&
  payload !== null &&
  'href' in payload &&
  typeof payload.href === 'string' &&
  'content' in payload &&
  typeof payload.content === 'string' &&
  'type' in payload &&
  typeof payload.type === 'string'

const useHTMLView = ({
  onLinkClicked,
}: {
  onLinkClicked: (payload: HTMLViewLinkPayload) => void
}) => {
  const theme: Theme = useTheme()
  const ref = useRef<WebView>(null)

  const onMessage = (event: WebViewMessageEvent) => {
    const action = JSON.parse(event.nativeEvent.data) as HTMLViewMessage

    if (action.type === 'link' && isHTMLViewLinkPayload(action.payload)) {
      onLinkClicked(action.payload)
    }
  }

  const wrapHTML = (html: string) => {
    return `
    <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
      </head>
      <style>
        ${fontRule}

        @keyframes fade { from { opacity: 0; } to { opacity: 1; }  }
  
        body {
          font-family: Literata Book;
          background-color: ${theme.colors.reverse};
          color: ${theme.colors.default};
          padding: 0 20px;
          padding-bottom: 40px;
          animation: 0.5s fade;
          font-size: 18px;
          line-height: 26px;
        }

        a {
          color: ${theme.colors.primary};
        }

        strong, bold {
          color: ${theme.colors.quart};
        }
  
        ul {
          margin: 0; padding: 0;
          list-style: none;
        }
      </style>
      <script type="text/javascript">
        (function () {
          setTimeout(() => {
            document.querySelectorAll('a').forEach(link => {
              link.addEventListener('click', e => {
                e.preventDefault();
                const href = e.target.attributes.href.textContent;
                const content = e.target.textContent;
                const className = e.target.className;
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: "link", payload: { href: href, content: content, type: className } }))
              })
            });
          }, 0)
        })()
      </script>
      <body>
        ${html}
      </body>
    </html>`
  }

  return {
    webviewProps(html: string) {
      return {
        ref,
        style: { backgroundColor: 'transparent' },
        originWhitelist: ['*'],
        source: { html: wrapHTML(html) },
        onMessage,
        onContentProcessDidTerminate: (syntheticEvent: WebViewTerminatedEvent) => {
          const { nativeEvent } = syntheticEvent
          console.warn('Content process terminated, reloading...')
          ref.current?.reload()
          Sentry.captureException(nativeEvent)
        },
        onRenderProcessGone: (syntheticEvent: WebViewRenderProcessGoneEvent) => {
          const { nativeEvent } = syntheticEvent
          ref.current?.reload()
          Sentry.captureException(nativeEvent)
        },
      }
    },
  }
}

export default useHTMLView

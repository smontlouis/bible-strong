import { useTheme } from '@emotion/react'
import { useCallback, useRef } from 'react'
import literata from '~assets/fonts/literata'
import { Theme } from '~themes'
import * as Sentry from '@sentry/react-native'
import {
  WebViewRenderProcessGoneEvent,
  WebViewTerminatedEvent,
} from 'react-native-webview/lib/WebViewTypes'

const fontRule = `@font-face { font-family: 'Literata Book'; src: local('Literata Book'), url('${literata}') format('woff');}`

const useHTMLView = ({ onLinkClicked }: { onLinkClicked: (href: string) => void }) => {
  const theme: Theme = useTheme()
  const ref = useRef<any>()

  const onMessage = useCallback((event: any) => {
    const action = JSON.parse(event.nativeEvent.data)

    if (action.type === 'link') {
      onLinkClicked(action.payload)
    }
  }, [])

  const wrapHTML = useCallback((html: string) => {
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
  }, [])

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

import { useTheme } from 'emotion-theming'
import literata from '~assets/fonts/literata'
import { Theme } from '~themes'

const fontRule = `@font-face { font-family: 'Literata Book'; src: local('Literata Book'), url('${literata}') format('woff');}`

const useHTMLView = ({
  onLinkClicked,
}: {
  onLinkClicked: (href: string) => void
}) => {
  const theme: Theme = useTheme()

  const onMessage = (event: any) => {
    const action = JSON.parse(event.nativeEvent.data)

    if (action.type === 'link') {
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
        style: { backgroundColor: 'transparent' },
        originWhitelist: ['*'],
        source: { html: wrapHTML(html) },
        onMessage,
      }
    },
  }
}

export default useHTMLView

import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextComponentType, NextPageContext } from 'next'
import { AppProps } from 'next/app'
import Head from 'next/head'
import { PropsWithChildren } from 'react'
import { theme } from '../theme'

import '../lib/firebase-ui-auth.css'
import '../lib/quill/quill.css'
import '../lib/quill/strong.css'
import '../lib/quill/verse.css'
import { I18nProvider } from '../locales'

const queryClient = new QueryClient()

interface Props extends AppProps {
  Component: NextComponentType<NextPageContext, any, {}> & {
    Layout?: ({ children }: PropsWithChildren<{}>) => JSX.Element
  }
}

const Noop = ({ children }: PropsWithChildren<{}>) => <>{children}</>

const App = ({ Component, pageProps }: Props) => {
  const Layout = Component.Layout || Noop

  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider resetCSS theme={theme}>
        <Head>
          <title key="title">Bible Strong App - Lexique Hébreu et Grec</title>
          <meta
            key="description"
            name="description"
            content="Le projet Bible Strong a pour objectif la mise à disposition d'outils efficaces d'étude de la Bible pour tous ceux qui souhaitent développer et affermir une foi réfléchie en Dieu par sa Parole."
          />
          <meta key="og:image" name="og:image" content="/image-fb.jpg" />
          <meta charSet="utf-8" />
          <meta
            name="viewport"
            content="initial-scale=1.0, width=device-width"
          />
          <link rel="icon" href="/images/icon.png" />
        </Head>
        <style jsx global>{`
          @font-face {
            font-display: swap;
            font-family: 'Pulp-Display';
            src: url('/fonts/UpType - Pulp Display Extra Light.otf')
              format('opentype');
            font-weight: 200;
          }
          @font-face {
            font-display: swap;
            font-family: 'Pulp-Display';
            src: url('/fonts/UpType - Pulp Display Light.otf')
              format('opentype');
            font-weight: 300;
          }
          @font-face {
            font-display: swap;
            font-family: 'Pulp-Display';
            src: url('/fonts/UpType - Pulp Display Regular.otf')
              format('opentype');
            font-weight: 400;
          }
          @font-face {
            font-display: swap;
            font-family: 'Pulp-Display';
            src: url('/fonts/UpType - Pulp Display Medium.otf')
              format('opentype');
            font-weight: 500;
          }
          @font-face {
            font-display: swap;
            font-family: 'Pulp-Display';
            src: url('/fonts/UpType - Pulp Display Semi Bold.otf')
              format('opentype');
            font-weight: 600;
          }
          @font-face {
            font-display: swap;
            font-family: 'Pulp-Display';
            src: url('/fonts/UpType - Pulp Display Bold.otf') format('opentype');
            font-weight: 700;
          }
          @font-face {
            font-display: swap;
            font-family: 'Pulp-Display';
            src: url('/fonts/UpType - Pulp Display Extra Bold.otf')
              format('opentype');
            font-weight: 800;
          }
          @media print {
            @page {
              margin: 2cm 3cm;
              margin-bottom: 3cm;
            }

            h1 {
              break-before: always;
              page-break-before: always;
            }

            .references-divider {
              break-before: always;
              page-break-before: always;
            }
          }

          @keyframes shine {
            0% {
              background-position: 0% 0%;
            }
            25% {
              background-position: 100% 0%;
            }
            50% {
              background-position: 100% 100%;
            }
            75% {
              background-position: 0% 100%;
            }
            100% {
              background-position: 0% 0%;
            }
          }
        `}</style>
        <I18nProvider locale={pageProps.locale}>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </I18nProvider>
      </ChakraProvider>
    </QueryClientProvider>
  )
}

export default App

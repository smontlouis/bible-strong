import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useState } from 'react'
import { WebView } from 'react-native-webview'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { resolveSystemPath, SITE_PAGE_ROUTE, sitePageUrl } from '~navigation/systemLinks'

/**
 * A page of the public site the application has no screen for (the home of a lexicon, a
 * shared study, a legal page), shown as the site draws it. A link followed from it to a
 * page the application does show opens that screen.
 */
const SitePageScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ path?: string | string[] }>()
  const url = sitePageUrl(Array.isArray(params.path) ? params.path[0] : params.path)
  const [title, setTitle] = useState('Bible Strong')

  if (!url) return <Redirect href="/" />

  return (
    <Container>
      <Header
        hasBackButton
        title={title}
        onCustomBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <WebView
        source={{ uri: url }}
        style={{ flex: 1 }}
        onNavigationStateChange={state => {
          if (state.title && !state.title.startsWith('http')) setTitle(state.title)
        }}
        onShouldStartLoadWithRequest={request => {
          const route = resolveSystemPath(request.url)
          if (route === request.url || route === '/' || route.startsWith(SITE_PAGE_ROUTE)) {
            return true
          }
          router.push(route as Href)
          return false
        }}
      />
    </Container>
  )
}

export default SitePageScreen

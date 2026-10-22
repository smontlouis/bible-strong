import { Linking } from 'react-native'
import { StreamdownText } from 'react-native-streamdown'
import {
  sourceIdFromLink,
  type StudySource,
  type StudyWidget,
} from '@bible-strong/ai-contract/contract'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { useTheme } from '~themes/ThemeProvider'
import { useAssistantSheet } from './assistantSheetContext'
import { responseBibleVersion } from './languagePreferences'
import { linkifyBibleReferences, passageOsisFromLink } from './linkifyBibleReferences'
import { prepareMarkdown, safeLink } from './markdown'

export default function AssistantMessageMarkdown({
  text,
  streaming,
  sources,
  widgets,
}: {
  text: string
  streaming: boolean
  sources: StudySource[]
  widgets: StudyWidget[]
}) {
  const { colors } = useTheme()
  const { navigate, showSource } = useAssistantSheet()
  const passageVersion = responseBibleVersion(sources, widgets)
  const openLink = (url: string) => {
    const osis = passageOsisFromLink(url)
    if (osis) {
      const route = getBibleViewRouteForStrongOsisReference(osis)
      if (route)
        navigate({
          ...route,
          params: { ...route.params, ...(passageVersion ? { version: passageVersion } : {}) },
        })
      return
    }
    const sourceId = sourceIdFromLink(url)
    if (sourceId) {
      // A citation only resolves against the sources stored with this very message.
      const source = sources.find(item => item.id === sourceId)
      if (source) showSource(source)
      return
    }
    const safe = safeLink(url)
    if (safe) void Linking.openURL(safe).catch(() => {})
  }
  return (
    <StreamdownText
      // Streamdown closes the Markdown still being streamed on a worklet thread, so a
      // half-written link or emphasis never shows its raw syntax.
      markdown={linkifyBibleReferences(prepareMarkdown(text))}
      flavor="github"
      selectable={!streaming}
      md4cFlags={{ latexMath: false }}
      onLinkPress={({ url }) => openLink(url)}
      markdownStyle={{
        paragraph: { color: colors.default, fontSize: 16, lineHeight: 25 },
        h1: { color: colors.default, fontSize: 22 },
        h2: { color: colors.default, fontSize: 19 },
        h3: { color: colors.default, fontSize: 17 },
        strong: { color: colors.default },
        link: { color: colors.link },
        code: { color: colors.default, backgroundColor: colors.lightGrey },
        codeBlock: { color: colors.default, backgroundColor: colors.lightGrey },
      }}
    />
  )
}

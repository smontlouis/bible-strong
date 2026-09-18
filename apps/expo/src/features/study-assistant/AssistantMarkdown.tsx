import { Linking } from 'react-native'
import { StreamdownText } from 'react-native-streamdown'
import { useTheme } from '~themes/ThemeProvider'
import { prepareMarkdown, safeLink } from './markdown'
export default function AssistantMarkdown({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
  sources?: import('@bible-strong/ai-contract/contract').StudySource[]
  widgets?: import('@bible-strong/ai-contract/contract').StudyWidget[]
}) {
  const { colors } = useTheme()
  return (
    <StreamdownText
      markdown={prepareMarkdown(text)}
      flavor="github"
      selectable={!streaming}
      md4cFlags={{ latexMath: false }}
      onLinkPress={({ url }) => {
        const safe = safeLink(url)
        if (safe) void Linking.openURL(safe).catch(() => {})
      }}
      markdownStyle={{
        paragraph: { color: colors.default, fontSize: 16, lineHeight: 26 },
        h1: { color: colors.default, fontSize: 24 },
        h2: { color: colors.default, fontSize: 21 },
        h3: { color: colors.default, fontSize: 18 },
        strong: { color: colors.default },
        link: { color: colors.primary },
        code: { color: colors.default, backgroundColor: colors.lightGrey },
        codeBlock: { color: colors.default, backgroundColor: colors.lightGrey },
      }}
    />
  )
}

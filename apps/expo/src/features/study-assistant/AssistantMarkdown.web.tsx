import { responseBibleVersion } from './languagePreferences'
import remarkBibleLinks from './remarkBibleLinks'
import PassageLink from './PassageLink.web'
import {
  sourceIdFromLink,
  type StudySource,
  type StudyWidget,
} from '@bible-strong/ai-contract/contract'
import SourceCitation from './SourceCitation.web'
import { useTheme } from '~themes/ThemeProvider'
import { Streamdown, defaultRemarkPlugins } from 'streamdown'
import { prepareMarkdown, safeLink } from './markdown'
import './assistant-markdown.css'
export default function AssistantMarkdown({
  text,
  streaming,
  sources = [],
  widgets = [],
}: {
  text: string
  streaming: boolean
  sources?: StudySource[]
  widgets?: StudyWidget[]
}) {
  const { colors } = useTheme()
  const passageVersion = responseBibleVersion(sources, widgets)
  return (
    <div className="study-assistant-markdown" style={{ color: colors.default }}>
      <Streamdown
        isAnimating={streaming}
        controls={false}
        remarkPlugins={[...Object.values(defaultRemarkPlugins), remarkBibleLinks]}
        components={{
          img: () => null,
          a: ({ href, children }) => {
            if (href?.startsWith('https://bible-strong.app/assistant-passage/')) {
              try {
                return (
                  <PassageLink
                    version={passageVersion}
                    osis={decodeURIComponent(href.split('/assistant-passage/')[1])}
                  >
                    {children}
                  </PassageLink>
                )
              } catch {
                return <span>{children}</span>
              }
            }
            const sourceId = href ? sourceIdFromLink(href) : undefined
            if (sourceId) {
              const source = sources.find(item => item.id === sourceId)
              return source ? (
                <SourceCitation source={source}>{children}</SourceCitation>
              ) : (
                <span>{children}</span>
              )
            }
            if (href?.startsWith('https://bible-strong.app/assistant-source/'))
              return <span>{children}</span>
            const url = href ? safeLink(href) : undefined
            return url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            )
          },
        }}
      >
        {prepareMarkdown(text)}
      </Streamdown>
    </div>
  )
}

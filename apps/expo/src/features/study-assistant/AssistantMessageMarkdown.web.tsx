import { StreamdownTextPrimitive } from '@assistant-ui/react-streamdown'
import { defaultRemarkPlugins } from 'streamdown'
import { useTheme } from '~themes/ThemeProvider'
import type { StudySource, StudyWidget } from '@bible-strong/ai-contract/contract'
import { sourceIdFromLink } from '@bible-strong/ai-contract/contract'
import { responseBibleVersion } from './languagePreferences'
import remarkBibleLinks from './remarkBibleLinks'
import PassageLink from './PassageLink.web'
import SourceCitation from './SourceCitation.web'
import { prepareMarkdown, safeLink } from './markdown'
import { messageSegments } from './widgetSegments'
import './assistant-markdown.css'

export default function AssistantMessageMarkdown({
  sources,
  widgets,
  segment,
}: {
  sources: StudySource[]
  widgets: StudyWidget[]
  /** Index of the Markdown segment to show when the answer places cards in its text. */
  segment?: number
}) {
  const { colors } = useTheme()
  const passageVersion = responseBibleVersion(sources, widgets)
  // The primitive reads the whole text part; each instance keeps only its own segment.
  const widgetIds = new Set(widgets.map(widget => widget.id))
  const preprocess = (text: string) => {
    if (segment === undefined) return prepareMarkdown(text)
    const part = messageSegments(text, widgetIds)[segment]
    return part?.type === 'markdown' ? prepareMarkdown(part.text) : ''
  }
  return (
    <StreamdownTextPrimitive
      containerClassName="study-assistant-markdown"
      containerProps={{ style: { color: colors.default } }}
      preprocess={preprocess}
      defer
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
    />
  )
}

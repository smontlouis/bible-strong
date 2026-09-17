import { useTheme } from '~themes/ThemeProvider'
import { Streamdown } from 'streamdown'
import { prepareMarkdown, safeLink } from './markdown'
import './assistant-markdown.css'
export default function AssistantMarkdown({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) {
  const { colors } = useTheme()
  return (
    <div className="study-assistant-markdown" style={{ color: colors.default }}>
      <Streamdown
        isAnimating={streaming}
        controls={false}
        components={{
          img: () => null,
          a: ({ href, children }) => {
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

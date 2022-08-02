import { DivProps, Settings, TagProps } from './types'
import { styled } from 'goober'
import { scaleFontSize } from './scaleFontSize'
import { OPEN_HIGHLIGHT_TAGS, dispatch } from './dispatch'

const Div = styled('div')(({ settings: { theme } }: DivProps) => ({
  position: 'relative',
  display: 'inline-flex',
}))

const Tag = styled('div')(
  ({ settings: { theme, colors, fontSizeScale } }: DivProps) => ({
    fontFamily: 'arial',
    padding: '2px 4px',
    borderRadius: '40px',
    color: colors[theme].default,
    backgroundColor: colors[theme].lightGrey,
    fontSize: scaleFontSize(12, fontSizeScale),
    marginLeft: 5,
  })
)

interface Props {
  settings: Settings
  tag: TagProps
}

const VerseTags = ({ tag, settings }: Props) => {
  const limit = 1
  if (!tag.tags?.length) {
    return null
  }
  const tags = tag.tags.slice(0, limit)
  return (
    <Div
      settings={settings}
      onClick={() =>
        dispatch({
          type: OPEN_HIGHLIGHT_TAGS,
          payload: tag,
        })
      }
    >
      {tags.map(t => (
        <Tag key={t.id} settings={settings}>
          {t.name}
        </Tag>
      ))}
      {!!(tag.tags.length - limit) && (
        <Tag settings={settings} style={{ opacity: 0.7 }}>
          + {tag.tags.length - limit}
        </Tag>
      )}
    </Div>
  )
}

export default VerseTags

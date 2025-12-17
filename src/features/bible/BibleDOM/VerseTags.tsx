import { styled } from 'goober'
import { scaleFontSize } from './scaleFontSize'
import { OPEN_HIGHLIGHT_TAGS } from './dispatch'
import { RootStyles, TaggedVerse } from './BibleDOMWrapper'
import { RootState } from '~redux/modules/reducer'
import { useDispatch } from './DispatchProvider'

const Div = styled('div')<RootStyles>(({ settings: { theme } }) => ({
  position: 'relative',
  display: 'inline-flex',
}))

const Tag = styled('div')<RootStyles>(({ settings: { theme, colors, fontSizeScale } }) => ({
  fontFamily: 'arial',
  padding: '2px 4px',
  borderRadius: '40px',
  color: colors[theme].default,
  backgroundColor: colors[theme].lightGrey,
  fontSize: scaleFontSize(12, fontSizeScale),
  marginLeft: '5px',
}))

interface Props {
  settings: RootState['user']['bible']['settings']
  tag: TaggedVerse
}

const VerseTags = ({ tag, settings }: Props) => {
  const dispatch = useDispatch()
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

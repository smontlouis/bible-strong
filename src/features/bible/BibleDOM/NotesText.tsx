import { styled } from 'goober'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'
import { RootState } from '~redux/modules/reducer'
import { NotedVerse, RootStyles } from './BibleDOMWrapper'
import * as Icon from '@expo/vector-icons'

const Div = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontFamily,
    webkitTouchCallout: 'none',
    mozUserSelect: 'none',
    msUserSelect: 'none',
    khtmlUserSelect: 'none',
    webkitUserSelect: 'none',
    color: colors[theme].quart,
    fontSize: scaleFontSize(isParallel ? 10 : 14, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 18 : 26, fontSizeScale),

    backgroundColor: colors[theme].reverse,
    boxShadow: `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
    borderRadius: '8px',
    padding: '4px 8px',
    wordBreak: 'break-word',
    marginRight: '4px',
    marginLeft: '4px',

    '&:active': {
      opacity: 0.4,
    },
  })
)

interface Props {
  notesText: NotedVerse[]
  settings: RootState['user']['bible']['settings']
  onClick: (x: string) => void
  isParallel?: boolean
}

const NotesText = ({ notesText, settings, onClick, isParallel }: Props) => {
  return (
    <span>
      {notesText.map(note => (
        <Div
          key={note.key}
          settings={settings}
          isParallel={isParallel}
          onClick={() => onClick(note.key)}
        >
          <Icon.Ionicons
            color={settings.colors[settings.theme].quart}
            name="document-text-outline"
            size={16}
            style={{ marginRight: 4 }}
          />
          <span>{truncate(note.description, 40)}</span>
        </Div>
      ))}
    </span>
  )
}

export default NotesText

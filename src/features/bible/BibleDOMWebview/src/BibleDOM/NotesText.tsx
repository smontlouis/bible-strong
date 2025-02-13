import { styled } from 'goober'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'
import { RootState } from '../../../../../redux/modules/reducer'
import { NotedVerse, RootStyles } from './BibleDOMWrapper'

const Div = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontFamily,
    webkitTouchCallout: 'none',
    mozUserSelect: 'none',
    msUserSelect: 'none',
    khtmlUserSelect: 'none',
    webkitUserSelect: 'none',
    color: colors[theme].quart,
    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 26 : 32, fontSizeScale),
  })
)

const Verse = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale } }) => ({
    paddingLeft: '3px',
    fontSize: scaleFontSize(isParallel ? 9 : 14, fontSizeScale),
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
          [
          <Verse isParallel={isParallel} settings={settings}>
            ({note.verses}){' '}
          </Verse>
          <span>{truncate(note.description, 10)}</span>]
        </Div>
      ))}
    </span>
  )
}

export default NotesText

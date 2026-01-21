import { styled } from 'goober'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'
import { RootState } from '~redux/modules/reducer'
import { NotedVerse, RootStyles } from './BibleDOMWrapper'
import * as Icon from '@expo/vector-icons'
import { InlineItemContainer, InlineItemIconWrapper, InlineItemText } from './InlineItem'

interface Props {
  notesText: NotedVerse[]
  settings: RootState['user']['bible']['settings']
  onClick: (x: string) => void
  isParallel?: boolean
  isDisabled?: boolean
}

const NotesText = ({ notesText, settings, onClick, isParallel, isDisabled }: Props) => {
  return (
    <span>
      {notesText.map(note => (
        <InlineItemContainer
          key={note.key}
          settings={settings}
          isParallel={isParallel}
          onClick={() => onClick(note.key)}
          isButton
          isDisabled={isDisabled}
        >
          <InlineItemIconWrapper settings={settings}>
            <Icon.Ionicons
              color={settings.colors[settings.theme].quart}
              name="document-text-outline"
              size={16}
            />
          </InlineItemIconWrapper>
          <InlineItemText settings={settings}>{truncate(note.description, 40)}</InlineItemText>
        </InlineItemContainer>
      ))}
    </span>
  )
}

export default NotesText

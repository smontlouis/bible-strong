import { styled } from 'goober'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'
import { RootState } from '~redux/modules/reducer'
import { NotedVerse, RootStyles } from './BibleDOMWrapper'
import Feather from '@expo/vector-icons/Feather'
import { personalContentIcons } from '~common/personalContent'
import { resolveUniverseColors } from '~themes/universeColors'
import { InlineItemContainer, InlineItemIconWrapper, InlineItemText } from './InlineItem'

interface Props {
  notesText: NotedVerse[]
  settings: RootState['user']['bible']['settings']
  onClick: (note: NotedVerse) => void
  isDisabled?: boolean
}

const NotesText = ({ notesText, settings, onClick, isDisabled }: Props) => {
  return (
    <span>
      {notesText.map(note => (
        <InlineItemContainer
          key={note.key}
          settings={settings}
          onClick={() => onClick(note)}
          isButton
          isDisabled={isDisabled}
        >
          <InlineItemIconWrapper settings={settings}>
            <Feather
              color={resolveUniverseColors(settings.colors[settings.theme], 'notes').foreground}
              name={personalContentIcons.notes}
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

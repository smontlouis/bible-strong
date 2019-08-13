import React from 'react'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/distance_in_words'
import frLocale from 'date-fns/locale/fr'
import * as Icon from '@expo/vector-icons'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import TagList from '~common/TagList'

import truncate from '~helpers/truncate'
import Paragraph from '~common/ui/Paragraph'
import theme from '~themes/default'

const NoteContainer = styled.TouchableOpacity(({ theme }) => ({
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

class BibleNoteItem extends React.Component {
  openModal = () => {
    this.setState({ isModalOpen: true })
  }

  closeModal = () => {
    this.setState({ isMenuOpen: false })
  }

  state = {
    isModalOpen: false,
    isMenuOpen: false
  }

  render() {
    const { item, openNoteEditor, setNoteSettings } = this.props
    const formattedDate = distanceInWords(Number(item.notes.date), Date.now(), { locale: frLocale })

    return (
      <NoteContainer onPress={() => openNoteEditor(item.noteId)}>
        <Box row justifyContent="space-between">
          <Text color="darkGrey" bold fontSize={11}>
            {item.reference} - Il y a {formattedDate}
          </Text>
          <Box row>
            <Icon.Feather
              name="more-vertical"
              size={20}
              color={theme.colors.tertiary}
              onPress={() => setNoteSettings(item.noteId)}
            />
          </Box>
        </Box>
        {!!item.notes.title && (
          <Text title fontSize={16} scale={-2}>
            {item.notes.title}
          </Text>
        )}
        {!!item.notes.description && (
          <Paragraph scale={-3} scaleLineHeight={-1}>
            {truncate(item.notes.description, 100)}
          </Paragraph>
        )}
        <TagList tags={item.notes.tags} />
      </NoteContainer>
    )
  }
}

export default BibleNoteItem

import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { FlatList } from 'react-native'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import FloatingButton from '~common/ui/FloatingButton'
import TagsModal from '~common/TagsModal'
import { updateStudy } from '~redux/modules/user'

import StudiesHeader from './StudiesHeader'
import StudySettingsModal from './StudySettingsModal'
import StudyTitlePrompt from './StudyTitlePrompt'
import StudyItem from './StudyItem'

const StudiesScreen = () => {
  const [isTagsOpen, setTagsIsOpen] = React.useState(false)
  const [isStudySettingsOpen, setStudySettings] = React.useState(false)
  const [titlePrompt, setTitlePrompt] = React.useState(false)
  const dispatch = useDispatch()

  const [selectedChip, setSelectedChip] = React.useState(null)
  const studies = useSelector(state => Object.values(state.user.bible.studies))

  studies.sort((a, b) => Number(b.modified_at) - Number(a.modified_at))

  return (
    <Container>
      <StudiesHeader
        setIsOpen={setTagsIsOpen}
        isOpen={isTagsOpen}
        selectedChip={selectedChip}
      />
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={() => setTagsIsOpen(false)}
        onSelected={(chip) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <Box flex>
        <FlatList data={studies}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <StudyItem
              key={item.id}
              study={item}
              setStudySettings={setStudySettings}
            />
          )}
        />
        <FloatingButton label='Nouvelle étude' icon='edit-2' route='EditStudy' />
      </Box>
      <StudySettingsModal
        isOpen={isStudySettingsOpen}
        onClosed={() => setStudySettings(false)}
        setTitlePrompt={setTitlePrompt}
      />
      <StudyTitlePrompt
        titlePrompt={titlePrompt}
        onClosed={() => setTitlePrompt(false)}
        onSave={(id, title) => dispatch(updateStudy({ id, title }))}
      />
    </Container>
  )
}

export default StudiesScreen

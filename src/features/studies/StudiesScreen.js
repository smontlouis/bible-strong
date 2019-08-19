import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { FlatList } from 'react-native'
import compose from 'recompose/compose'

import useLogin from '~helpers/useLogin'
import Empty from '~common/Empty'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import FloatingButton from '~common/ui/FloatingButton'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import MultipleTagsModal from '~common/MultipleTagsModal'
import { updateStudy, uploadStudy } from '~redux/modules/user'
import withLoginModal from '~common/withLoginModal'

import StudySettingsModal from './StudySettingsModal'
import StudyTitlePrompt from './StudyTitlePrompt'
import StudyItem from './StudyItem'

const StudiesScreen = () => {
  const { isLogged } = useLogin()
  const [isTagsOpen, setTagsIsOpen] = React.useState(false)
  const [isStudySettingsOpen, setStudySettings] = React.useState(false)
  const [titlePrompt, setTitlePrompt] = React.useState(false)
  const dispatch = useDispatch()

  const [selectedChip, setSelectedChip] = React.useState(null)
  const studies = useSelector(state => Object.values(state.user.bible.studies))

  const [multipleTagsItem, setMultipleTagsItem] = React.useState(false)

  const filteredStudies = studies.filter(s =>
    selectedChip ? s.tags && s.tags[selectedChip.id] : true
  )
  filteredStudies.sort((a, b) => Number(b.modified_at) - Number(a.modified_at))

  return (
    <Container>
      <TagsHeader
        hasBackButton
        title="Études"
        setIsOpen={setTagsIsOpen}
        isOpen={isTagsOpen}
        selectedChip={selectedChip}
      />
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={() => setTagsIsOpen(false)}
        onSelected={chip => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <MultipleTagsModal
        multiple
        item={multipleTagsItem}
        onClosed={() => setMultipleTagsItem(false)}
      />
      <Box flex>
        {filteredStudies.length ? (
          <FlatList
            data={filteredStudies}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <StudyItem key={item.id} study={item} setStudySettings={setStudySettings} />
            )}
          />
        ) : (
          <Empty source={require('~assets/images/empty.json')} message="Aucune étude..." />
        )}
        {isLogged && (
          <FloatingButton
            label="Nouvelle étude"
            icon="edit-2"
            route="EditStudy"
            params={{ canEdit: true }}
          />
        )}
      </Box>
      <StudySettingsModal
        isOpen={isStudySettingsOpen}
        onClosed={() => setStudySettings(false)}
        setTitlePrompt={setTitlePrompt}
        setMultipleTagsItem={setMultipleTagsItem}
      />
      <StudyTitlePrompt
        titlePrompt={titlePrompt}
        onClosed={() => setTitlePrompt(false)}
        onSave={(id, title) => {
          dispatch(updateStudy({ id, title }))
          dispatch(uploadStudy(id))
        }}
      />
    </Container>
  )
}

export default compose(withLoginModal)(StudiesScreen)

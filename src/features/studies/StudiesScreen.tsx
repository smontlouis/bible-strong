import React from 'react'
import { FlatList } from 'react-native'
import { useSelector, useDispatch } from 'react-redux'
import compose from 'recompose/compose'

import useLogin from '~helpers/useLogin'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import Empty from '~common/Empty'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import FloatingButton from '~common/ui/FloatingButton'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import MultipleTagsModal from '~common/MultipleTagsModal'
import { updateStudy } from '~redux/modules/user'
import withLoginModal from '~common/withLoginModal'

import StudySettingsModal from './StudySettingsModal'
import StudyTitlePrompt from './StudyTitlePrompt'
import StudyItem from './StudyItem'
import { useTranslation } from 'react-i18next'

const StudiesScreen = () => {
  const { t } = useTranslation()
  const { isLogged } = useLogin()
  const [isTagsOpen, setTagsIsOpen] = React.useState(false)
  const [isStudySettingsOpen, setStudySettings] = React.useState(false)
  const [titlePrompt, setTitlePrompt] = React.useState(false)
  const dispatch = useDispatch()
  const r = useMediaQueriesArray()

  const [selectedChip, setSelectedChip] = React.useState(null)
  const studies = useSelector(state => Object.values(state.user.bible.studies))

  const [multipleTagsItem, setMultipleTagsItem] = React.useState(false)

  const filteredStudies = studies.filter(s =>
    selectedChip ? s.tags && s.tags[selectedChip.id] : true
  )
  filteredStudies.sort((a, b) => Number(b.modified_at) - Number(a.modified_at))

  return (
    <Container bottomTabBarPadding>
      <Box flex>
        {filteredStudies.length ? (
          <FlatList
            key={r(['xs', 'sm', 'md', 'lg'])}
            ListHeaderComponent={
              <TagsHeader
                title={t('Études')}
                setIsOpen={setTagsIsOpen}
                isOpen={isTagsOpen}
                selectedChip={selectedChip}
              />
            }
            numColumns={r([2, 2, 3, 3])}
            data={filteredStudies}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <StudyItem
                key={item.id}
                study={item}
                setStudySettings={setStudySettings}
              />
            )}
          />
        ) : (
          <>
            <TagsHeader
              title={t('Études')}
              setIsOpen={setTagsIsOpen}
              isOpen={isTagsOpen}
              selectedChip={selectedChip}
            />
            <Empty
              source={require('~assets/images/empty.json')}
              message={t('Aucune étude...')}
            />
          </>
        )}
        {isLogged && (
          <FloatingButton
            label={t('Nouvelle étude')}
            icon="plus"
            route="EditStudy"
            params={{ canEdit: true }}
          />
        )}
      </Box>
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={() => setTagsIsOpen(false)}
        onSelected={chip => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <MultipleTagsModal
        item={multipleTagsItem}
        onClosed={() => setMultipleTagsItem(false)}
      />
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
          dispatch(updateStudy({ id, title, modified_at: Date.now() }))
        }}
      />
    </Container>
  )
}

export default compose(withLoginModal)(StudiesScreen)

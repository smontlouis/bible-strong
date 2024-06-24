import React from 'react'
import { FlatList } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'

import Empty from '~common/Empty'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import withLoginModal from '~common/withLoginModal'
import useLogin from '~helpers/useLogin'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { updateStudy } from '~redux/modules/user'

import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import StudyItem from './StudyItem'
import StudySettingsModal from './StudySettingsModal'
import StudyTitlePrompt from './StudyTitlePrompt'
import { Tag } from '~common/types'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

type StudiesScreenProps = {
  hasBackButton?: boolean
  navigation: StackNavigationProp<MainStackProps>
}

const StudiesScreen = ({ hasBackButton, navigation }: StudiesScreenProps) => {
  const { t } = useTranslation()
  const { isLogged } = useLogin()
  const dispatch = useDispatch()
  const r = useMediaQueriesArray()

  const [isTagsOpen, setTagsIsOpen] = React.useState(false)
  const [isStudySettingsOpen, setStudySettings] = React.useState(false)
  const [titlePrompt, setTitlePrompt] = React.useState(false)

  const [selectedChip, setSelectedChip] = React.useState<Tag | null>(null)
  const studies = useSelector(
    state => Object.values(state.user.bible.studies),
    shallowEqual
  )

  const filteredStudies = studies.filter(s =>
    selectedChip ? s.tags && s.tags[selectedChip.id] : true
  )
  filteredStudies.sort((a, b) => Number(b.modified_at) - Number(a.modified_at))

  return (
    <Container>
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
                hasBackButton={hasBackButton}
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
                navigation={navigation}
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
              hasBackButton={hasBackButton}
            />
            <Empty
              source={require('~assets/images/empty.json')}
              message={t('Aucune étude...')}
            />
          </>
        )}
        {isLogged && (
          <FabButton
            icon="add"
            onPress={() => {
              navigation.navigate('EditStudy', { canEdit: true })
            }}
            align="flex-end"
          />
        )}
      </Box>
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={() => setTagsIsOpen(false)}
        onSelected={(chip: Tag) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <StudySettingsModal
        isOpen={isStudySettingsOpen}
        onClosed={() => setStudySettings(false)}
        setTitlePrompt={setTitlePrompt}
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

export default withLoginModal(StudiesScreen)

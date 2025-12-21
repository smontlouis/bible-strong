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

import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { Tag } from '~common/types'
import { MainStackProps } from '~navigation/type'
import { RootState } from '~redux/modules/reducer'
import StudyItem from './StudyItem'
import StudySettingsModal from './StudySettingsModal'
import StudyTitlePrompt from './StudyTitlePrompt'
import generateUUID from '~helpers/generateUUID'

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
  const [pendingStudyId, setPendingStudyId] = React.useState<string | null>(null)

  const [selectedChip, setSelectedChip] = React.useState<Tag | null>(null)
  const studies = useSelector(
    (state: RootState) => Object.values(state.user.bible.studies),
    shallowEqual
  )

  const pendingStudy = useSelector((state: RootState) =>
    pendingStudyId ? state.user.bible.studies[pendingStudyId] : null
  )

  // Navigate to the edit study screen when a new study is created
  React.useEffect(() => {
    if (pendingStudyId && pendingStudy) {
      navigation.navigate('EditStudy', {
        canEdit: true,
        studyId: pendingStudyId,
      })
      setPendingStudyId(null)
    }
  }, [pendingStudy, pendingStudyId])

  const filteredStudies = studies.filter(s =>
    selectedChip ? s.tags && s.tags[selectedChip.id] : true
  )
  filteredStudies.sort((a, b) => Number(b.modified_at) - Number(a.modified_at))

  return (
    <Container>
      {filteredStudies.length ? (
        <FlatList
          key={r(['xs', 'sm', 'md', 'lg'])}
          stickyHeaderIndices={[0]}
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
          <Empty source={require('~assets/images/empty.json')} message={t('Aucune étude...')} />
        </>
      )}
      {isLogged && (
        // @ts-ignore
        <FabButton
          icon="plus"
          onPress={() => {
            const studyUuid = generateUUID()
            setPendingStudyId(studyUuid)
            dispatch(
              updateStudy({
                id: studyUuid,
                title: t('Document sans titre'),
                content: null,
                created_at: Date.now(),
                modified_at: Date.now(),
              })
            )
          }}
        />
      )}
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
        onSave={(id: any, title: any) => {
          dispatch(updateStudy({ id, title, modified_at: Date.now() }))
        }}
      />
    </Container>
  )
}

export default withLoginModal(StudiesScreen)

import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import React, { useCallback, useRef, useState } from 'react'
import { FlatList } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'

import Empty from '~common/Empty'
import RenameModal from '~common/RenameModal'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import withLoginModal from '~common/withLoginModal'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import useLogin from '~helpers/useLogin'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { updateStudy } from '~redux/modules/user'

import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Tag } from '~common/types'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import generateUUID from '~helpers/generateUUID'
import { RootState } from '~redux/modules/reducer'
import StudyItem from './StudyItem'
import StudySettingsModal from './StudySettingsModal'

type StudiesScreenProps = {
  hasBackButton?: boolean
  onStudySelect?: (studyId: string) => void
}

const StudiesScreen = ({ hasBackButton, onStudySelect }: StudiesScreenProps) => {
  const router = useRouter()
  const { t } = useTranslation()
  const { isLogged } = useLogin()
  const { isInTab } = useTabContext()
  const dispatch = useDispatch()
  const r = useMediaQueriesArray()

  const tagsModal = useBottomSheetModal()
  const [studySettingsId, setStudySettingsId] = React.useState<string | false>(false)
  const studySettingsModal = useBottomSheetModal()
  const renameModalRef = useRef<BottomSheetModal>(null)
  const [studyToRename, setStudyToRename] = useState<{ id: string; title: string } | null>(null)
  const [pendingStudyId, setPendingStudyId] = React.useState<string | null>(null)

  const openStudySettings = useCallback(
    (studyId: string) => {
      setStudySettingsId(studyId)
      studySettingsModal.open()
    },
    [studySettingsModal]
  )

  const openRenameModal = useCallback((data: { id: string; title: string }) => {
    setStudyToRename(data)
    renameModalRef.current?.present()
  }, [])

  const onStudyPress = useCallback(
    (studyId: string) => {
      if (isInTab && onStudySelect) {
        onStudySelect(studyId)
      } else {
        router.push({
          pathname: '/edit-study',
          params: { studyId },
        })
      }
    },
    [isInTab, onStudySelect, router]
  )

  const [selectedChip, setSelectedChip] = React.useState<Tag | null>(null)
  const studies = useSelector(
    (state: RootState) => Object.values(state.user.bible.studies),
    shallowEqual
  )

  const pendingStudy = useSelector((state: RootState) =>
    pendingStudyId ? state.user.bible.studies[pendingStudyId] : null
  )

  // Open the study when a new study is created
  React.useEffect(() => {
    if (pendingStudyId && pendingStudy) {
      onStudyPress(pendingStudyId)
      setPendingStudyId(null)
    }
  }, [pendingStudy, pendingStudyId, onStudyPress])

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
              setIsOpen={tagsModal.open}
              isOpen={false}
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
              setStudySettings={openStudySettings}
              onPress={onStudyPress}
            />
          )}
        />
      ) : (
        <>
          <TagsHeader
            title={t('Études')}
            setIsOpen={tagsModal.open}
            isOpen={false}
            selectedChip={selectedChip}
            hasBackButton={hasBackButton}
          />
          <Empty icon={require('~assets/images/empty-state-icons/study.svg')} message={t('Aucune étude...')} />
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
        ref={tagsModal.ref}
        onClosed={() => {}}
        onSelected={(chip: Tag | null) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <StudySettingsModal
        ref={studySettingsModal.ref}
        studyId={studySettingsId}
        onClosed={() => setStudySettingsId(false)}
        openRenameModal={openRenameModal}
      />
      <RenameModal
        bottomSheetRef={renameModalRef}
        title={t("Renommer l'étude")}
        placeholder={t("Nom de l'étude")}
        initialValue={studyToRename?.title}
        onSave={value => {
          if (studyToRename) {
            dispatch(updateStudy({ id: studyToRename.id, title: value, modified_at: Date.now() }))
          }
        }}
      />
    </Container>
  )
}

export default withLoginModal(StudiesScreen)

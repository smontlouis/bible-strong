import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import { useEffect, useRef, useState } from 'react'
import { FlatList } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { useSetAtom } from 'jotai/react'

import Empty from '~common/Empty'
import RenameModal from '~common/RenameModal'
import TagsHeader from '~common/TagsHeader'
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
import { unifiedTagsModalAtom } from '~state/app'
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

  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const [studySettingsId, setStudySettingsId] = useState<string | false>(false)
  const studySettingsModal = useBottomSheetModal()
  const renameModalRef = useRef<BottomSheetModal>(null)
  const [studyToRename, setStudyToRename] = useState<{ id: string; title: string } | null>(null)
  const [pendingStudyId, setPendingStudyId] = useState<string | null>(null)

  const openStudySettings = (studyId: string) => {
    setStudySettingsId(studyId)
    studySettingsModal.open()
  }

  const openRenameModal = (data: { id: string; title: string }) => {
    setStudyToRename(data)
    renameModalRef.current?.present()
  }

  const onStudyPress = (studyId: string) => {
    if (isInTab && onStudySelect) {
      onStudySelect(studyId)
    } else {
      router.push({
        pathname: '/edit-study',
        params: { studyId },
      })
    }
  }

  const [selectedChip, setSelectedChip] = useState<Tag | null>(null)

  const openTagsModal = () => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag: selectedChip ?? undefined,
      onSelect: (tag?: Tag) => setSelectedChip(tag ?? null),
    })
  }

  const studies = useSelector(
    (state: RootState) => Object.values(state.user.bible.studies),
    shallowEqual
  )

  const pendingStudy = useSelector((state: RootState) =>
    pendingStudyId ? state.user.bible.studies[pendingStudyId] : null
  )

  // Open the study when a new study is created
  useEffect(() => {
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
              setIsOpen={openTagsModal}
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
            setIsOpen={openTagsModal}
            isOpen={false}
            selectedChip={selectedChip}
            hasBackButton={hasBackButton}
          />
          <Empty
            icon={require('~assets/images/empty-state-icons/study.svg')}
            message={t('Aucune étude...')}
          />
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

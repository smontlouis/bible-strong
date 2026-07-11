import { type SheetRef } from '~common/sheet'
import { useEffect, useRef, useState } from 'react'
import { FlatList } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { useAtom, useSetAtom } from 'jotai/react'

import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import RenameModal from '~common/RenameModal'
import Box from '~common/ui/Box'
import FabButton from '~common/ui/FabButton'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { useSheet } from '~helpers/useSheet'
import useLogin from '~helpers/useLogin'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { updateStudy } from '~redux/modules/user'

import { useTranslation } from 'react-i18next'
import { Tag } from '~common/types'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import generateUUID from '~helpers/generateUUID'
import { RootState } from '~redux/modules/reducer'
import { selectRelationCountsByEndpointIdentity } from '~redux/selectors/bible'
import { unifiedTagsModalAtom } from '~state/app'
import { endpointIdentity } from '~features/studyRelations/domain'
import { createStudyEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import StudyItem from './StudyItem'
import StudySettingsModal from './StudySettingsModal'
import ChoiceFilterModal from '~common/ChoiceFilterModal'
import { useEntityListQueryFilters } from '~common/EntityListQueryFilters'
import { queryEntityList, type EntityListSort } from '~features/entityListQuery/entityListQuery'
import { deltaToPlainText } from '~helpers/deltaToPlainText'
import {
  defaultStudiesListQueryState,
  studiesListQueryAtom,
  type StudiesListQueryState,
} from '~state/entityListFilters'

type StudiesScreenProps = {
  hasBackButton?: boolean
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
  onStudySelect?: (studyId: string) => void
}

const StudiesScreen = ({
  hasBackButton,
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
  onStudySelect,
}: StudiesScreenProps) => {
  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const { isLogged } = useLogin()
  const { isInTab } = useTabContext()
  const dispatch = useDispatch()
  const r = useMediaQueriesArray()

  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const [studySettingsId, setStudySettingsId] = useState<string | false>(false)
  const studySettingsModal = useSheet()
  const openEntityRelations = useOpenEntityRelations()
  const renameModalRef = useRef<SheetRef>(null)
  const publicationModalRef = useRef<SheetRef>(null)
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onStudyPress = (studyId: string) => {
    if (isNewTabSelection) {
      const study = studies.find(candidate => candidate.id === studyId)

      resolveNewTabSelection({
        id: newTabId || 'new',
        title: study?.title || t('Études'),
        isRemovable: true,
        type: 'study',
        data: {
          studyId,
        },
      })
      return
    }

    if (isInTab && onStudySelect) {
      onStudySelect(studyId)
    } else {
      pushRouteOnce({
        pathname: '/edit-study',
        params: { studyId },
      })
    }
  }

  const [queryState, setQueryState] = useAtom(studiesListQueryAtom)
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const selectedChip = queryState.tagId ? tags[queryState.tagId] || null : null

  useEffect(() => {
    if (queryState.tagId && !tags[queryState.tagId]) {
      setQueryState(state => ({ ...state, tagId: null }))
    }
  }, [queryState.tagId, setQueryState, tags])

  const openTagsModal = () => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag: selectedChip ?? undefined,
      onSelect: (tag?: Tag) => setQueryState(state => ({ ...state, tagId: tag?.id || null })),
    })
  }

  const studies = useSelector(
    (state: RootState) =>
      Object.entries(state.user.bible.studies).map(([studyId, study]) => ({
        ...study,
        id: study.id || studyId,
      })),
    shallowEqual
  )
  const relationCountsByEndpoint = useSelector(selectRelationCountsByEndpointIdentity)

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

  const sortOptions = [
    { value: 'newest', label: t('entityList.sort.newest') },
    { value: 'oldest', label: t('entityList.sort.oldest') },
    { value: 'created-newest', label: t('entityList.sort.createdNewest') },
    { value: 'created-oldest', label: t('entityList.sort.createdOldest') },
    { value: 'title-asc', label: t('entityList.sort.titleAsc') },
    { value: 'title-desc', label: t('entityList.sort.titleDesc') },
  ] satisfies readonly { value: EntityListSort; label: string }[]
  const queryFilters = useEntityListQueryFilters({
    query: queryState.query,
    sort: queryState.sort,
    sortOptions,
    onQueryChange: query => setQueryState(state => ({ ...state, query })),
    onSortChange: sort => setQueryState(state => ({ ...state, sort })),
  })
  const publicationLabels: Record<StudiesListQueryState['publication'], string> = {
    all: t('Tous'),
    draft: t('Brouillons'),
    published: t('Publiées'),
  }
  const matchingStudies = studies.filter(study => {
    if (selectedChip && !study.tags?.[selectedChip.id]) return false
    if (queryState.publication === 'published') return study.published === true
    if (queryState.publication === 'draft') return study.published !== true
    return true
  })
  const filteredStudies = queryEntityList(
    matchingStudies.map(study => ({
      ...study,
      title: study.title || t('Étude sans titre'),
      description: study.content?.ops
        ? deltaToPlainText(study.content.ops as Parameters<typeof deltaToPlainText>[0])
        : undefined,
      date: Number(study.modified_at || 0),
      createdAt: Number(study.created_at || 0),
    })),
    queryState
  )
  const activeFilters = Boolean(
    queryState.query.trim() ||
    queryState.tagId ||
    queryState.publication !== 'all' ||
    queryState.sort !== 'newest'
  )

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <FiltersHeader
          title={t('Études')}
          filterLabel={selectedChip?.name}
          hasBackButton={showBackButton}
          hasActiveFilters={activeFilters}
          onReset={() => setQueryState(defaultStudiesListQueryState)}
          filters={[
            ...queryFilters.filters,
            {
              key: 'tags',
              icon: 'tag',
              label: t('Tags'),
              value: selectedChip?.name || t('Tous'),
              onPress: openTagsModal,
            },
            {
              key: 'publication',
              icon: 'send',
              label: t('Publication'),
              value: publicationLabels[queryState.publication],
              onPress: () => publicationModalRef.current?.present(),
            },
          ]}
        />
        {queryFilters.modals}
        <ChoiceFilterModal
          ref={publicationModalRef}
          title={t('Publication')}
          selectedValue={queryState.publication}
          options={Object.entries(publicationLabels).map(([value, label]) => ({
            value: value as StudiesListQueryState['publication'],
            label,
          }))}
          onSelect={publication => {
            setQueryState(state => ({ ...state, publication }))
            publicationModalRef.current?.dismiss()
          }}
        />
        {filteredStudies.length ? (
          <FlatList
            key={r(['xs', 'sm', 'md', 'lg'])}
            numColumns={r([2, 2, 3, 3])}
            data={filteredStudies}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const endpoint = createStudyEndpoint(item.id, item.title)
              return (
                <StudyItem
                  key={item.id}
                  study={item}
                  setStudySettings={openStudySettings}
                  onPress={onStudyPress}
                  relationCount={relationCountsByEndpoint[endpointIdentity(endpoint)] || 0}
                  onRelationPress={() => {
                    openEntityRelations(endpoint)
                  }}
                />
              )
            }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/study.svg')}
            message={
              studies.length
                ? queryState.query.trim()
                  ? t('Aucun résultat trouvé pour "{{query}}"', { query: queryState.query })
                  : t('entityList.noFilterMatch')
                : t('Aucune étude...')
            }
          />
        )}
        {isLogged && (
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
          sheetRef={renameModalRef}
          title={t("Renommer l'étude")}
          placeholder={t("Nom de l'étude")}
          initialValue={studyToRename?.title}
          onSave={value => {
            if (studyToRename) {
              dispatch(updateStudy({ id: studyToRename.id, title: value, modified_at: Date.now() }))
            }
          }}
        />
      </Box>
    </FormSheetScreen>
  )
}

export default StudiesScreen

import React, { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams } from 'expo-router'
import { useAtom, useSetAtom } from 'jotai/react'

import BibleLinkItem from './BibleLinkItem'
import BibleLinksSettingsModal from './BibleLinksSettingsModal'
import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Header from '~common/Header'
import Empty from '~common/Empty'

import FiltersHeader from '~common/FiltersHeader'
import { useSheet } from '~helpers/useSheet'
import { unifiedTagsModalAtom } from '~state/app'
import verseToReference from '~helpers/verseToReference'
import { Tag } from '~common/types'
import { Link } from '~redux/modules/user'
import { RootState } from '~redux/modules/reducer'
import {
  selectLinks,
  selectRelationCountsByEndpointIdentity,
  selectRelations,
} from '~redux/selectors/bible'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import { createExternalLinkEndpointFromLink } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import ChoiceFilterModal from '~common/ChoiceFilterModal'
import { type SheetRef } from '~common/sheet'
import { useEntityListQueryFilters } from '~common/EntityListQueryFilters'
import { queryEntityList, type EntityListSort } from '~features/entityListQuery/entityListQuery'
import { defaultLinksListQueryState, linksListQueryAtom } from '~state/entityListFilters'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'

type TLink = {
  linkId: string
  reference: string
  link: Link
}

type BibleVerseLinksProps = {
  isFormSheet?: boolean
}

const BibleVerseLinks = ({ isFormSheet = false }: BibleVerseLinksProps) => {
  const params = useLocalSearchParams<{ withBack?: string; verse?: string }>()
  const withBack = params.withBack === 'true'
  const verse = params.verse || ''
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : withBack
  const hasListBackButton = isFormSheet ? canGoBackInStack : true

  const [title, setTitle] = useState('')
  const [links, setLinks] = useState<TLink[]>([])
  const [queryState, setQueryState] = useAtom(linksListQueryAtom)
  const typeModalRef = useRef<SheetRef>(null)
  const [linkSettingsId, setLinkSettingsId] = useState<string | null>(null)
  const _links = useSelector(selectLinks)
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const selectedChip = queryState.tagId ? tags[queryState.tagId] || null : null

  useEffect(() => {
    if (queryState.tagId && !tags[queryState.tagId]) {
      setQueryState(state => ({ ...state, tagId: null }))
    }
    if (queryState.linkType && !Object.hasOwn(linkTypeConfig, queryState.linkType)) {
      setQueryState(state => ({ ...state, linkType: null }))
    }
  }, [queryState.linkType, queryState.tagId, setQueryState, tags])
  const relations = useSelector(selectRelations)
  const relationCountsByEndpoint = useSelector(selectRelationCountsByEndpointIdentity)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const linkSettingsModal = useSheet()
  const openEntityRelations = useOpenEntityRelations()

  const openTagsModal = () => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag: selectedChip ?? undefined,
      onSelect: (tag?: Tag) => setQueryState(state => ({ ...state, tagId: tag?.id || null })),
    })
  }

  const openLinkSettings = (linkId: string) => {
    setLinkSettingsId(linkId)
    linkSettingsModal.open()
  }

  const getLinkEndpoint = (
    linkId: string
  ): Extract<RelationEndpoint, { type: 'externalLink' }> | null => {
    const link = _links[linkId]
    if (!link) return null

    return createExternalLinkEndpointFromLink(linkId, link)
  }

  const openLinkRelations = (linkId: string) => {
    const endpoint = getLinkEndpoint(linkId)
    if (!endpoint) return
    openEntityRelations(endpoint)
  }

  const loadPage = async () => {
    let title
    const filtered_links: TLink[] = []

    if (verse) {
      title = verseToReference(verse)
      title = `${t('Liens sur')} ${title}...`
    } else {
      title = t('Liens')
    }

    if (!verse) {
      Object.entries(_links).forEach(([linkId, link]) => {
        const verseKeys = new Set<string>()
        Object.values(relations).forEach(relation => {
          if (relation.kind !== 'system' || relation.type !== 'externalLink') return
          const linkEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'externalLink')
          const verseEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'verse')
          if (linkEndpoint?.type !== 'externalLink' || linkEndpoint.linkId !== linkId) return
          if (verseEndpoint?.type !== 'verse') return
          verseEndpoint.verseKeys.forEach(key => verseKeys.add(key))
        })
        const reference = verseKeys.size
          ? verseToReference(Object.fromEntries(Array.from(verseKeys).map(key => [key, true])))
          : ''
        filtered_links.push({ linkId, reference, link })
      })
      filtered_links.sort((a, b) => Number(b.link.date) - Number(a.link.date))
      setTitle(title)
      setLinks(filtered_links)
      return
    }

    Object.values(relations).forEach(relation => {
      if (relation.kind !== 'system' || relation.type !== 'externalLink') return
      const linkEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'externalLink')
      const verseEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'verse')
      if (linkEndpoint?.type !== 'externalLink' || verseEndpoint?.type !== 'verse') return
      if (verse && !verseEndpoint.verseKeys.includes(verse)) return
      const link = _links[linkEndpoint.linkId]
      if (!link) return
      const verseNumbers = Object.fromEntries(verseEndpoint.verseKeys.map(key => [key, true]))
      const reference = verseToReference(verseNumbers)
      filtered_links.push({ linkId: linkEndpoint.linkId, reference, link })
    })

    setTitle(title)
    setLinks(filtered_links)
  }

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verse, _links, relations])

  const openLink = (linkId: string) => {
    pushRouteOnce({ pathname: '/link', params: { linkId } })
  }

  const renderLink = ({ item, index }: { item: TLink; index: number }) => {
    const endpoint = getLinkEndpoint(item.linkId)

    return (
      <BibleLinkItem
        key={index}
        item={item}
        onPress={openLink}
        onMenuPress={openLinkSettings}
        relationCount={endpoint ? relationCountsByEndpoint[endpointIdentity(endpoint)] || 0 : 0}
        onRelationPress={() => {
          openLinkRelations(item.linkId)
        }}
      />
    )
  }

  const sortOptions = [
    { value: 'newest', label: t('entityList.sort.newest') },
    { value: 'oldest', label: t('entityList.sort.oldest') },
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
  const filteredLinks = verse
    ? links
    : queryEntityList(
        links.reduce<(TLink & { id: string; title: string; description: string; date: number })[]>(
          (result, item) => {
            if (selectedChip && !item.link.tags?.[selectedChip.id]) return result
            if (queryState.linkType && item.link.linkType !== queryState.linkType) return result
            result.push({
              ...item,
              id: item.linkId,
              title: item.link.customTitle || item.link.ogData?.title || item.link.url,
              description: [item.link.ogData?.description, item.link.url].filter(Boolean).join(' '),
              date: Number(item.link.date || 0),
            })
            return result
          },
          []
        ),
        queryState
      )
  const typeOptions = [
    { value: 'all', label: t('Tous') },
    ...Object.keys(linkTypeConfig).map(value => ({ value, label: t(value) || value })),
  ]
  const typeLabel =
    typeOptions.find(option => option.value === (queryState.linkType || 'all'))?.label ||
    t('Tous') ||
    'Tous'
  const activeFilters = Boolean(
    queryState.query.trim() ||
    queryState.tagId ||
    queryState.linkType ||
    queryState.sort !== 'newest'
  )

  const selectedLink = links.find(link => link.linkId === linkSettingsId)

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        {verse ? (
          <Header hasBackButton={hasBackButton} title={title || t('Chargement...')} />
        ) : (
          <FiltersHeader
            title={t('Liens')}
            filterLabel={selectedChip?.name}
            hasBackButton={hasListBackButton}
            hasActiveFilters={activeFilters}
            onReset={() => setQueryState(defaultLinksListQueryState)}
            filters={[
              ...queryFilters.filters,
              {
                key: 'type',
                icon: 'link',
                label: t('Type'),
                value: typeLabel,
                onPress: () => typeModalRef.current?.present(),
              },
              {
                key: 'tags',
                icon: 'tag',
                label: t('Tags'),
                value: selectedChip?.name || t('Tous') || 'Tous',
                onPress: openTagsModal,
              },
            ]}
          />
        )}
        {!verse && queryFilters.modals}
        {!verse && (
          <ChoiceFilterModal
            ref={typeModalRef}
            title={t('Type')}
            selectedValue={queryState.linkType || 'all'}
            options={typeOptions}
            onSelect={linkType => {
              setQueryState(state => ({ ...state, linkType: linkType === 'all' ? null : linkType }))
              typeModalRef.current?.dismiss()
            }}
          />
        )}
        {filteredLinks.length ? (
          <FlatList
            data={filteredLinks}
            renderItem={renderLink}
            keyExtractor={(item: TLink) => item.linkId}
            style={{ paddingBottom: 30 }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/link.svg')}
            message={
              links.length
                ? queryState.query.trim()
                  ? t('Aucun résultat trouvé pour "{{query}}"', { query: queryState.query })
                  : t('entityList.noFilterMatch')
                : t("Vous n'avez pas encore de liens...")
            }
          />
        )}
        <BibleLinksSettingsModal
          ref={linkSettingsModal.getRef()}
          title={
            selectedLink?.link.ogData?.title ||
            selectedLink?.link.customTitle ||
            selectedLink?.link.url ||
            ''
          }
          linkId={linkSettingsId}
          onClosed={() => setLinkSettingsId(null)}
          onEditRelations={openLinkRelations}
        />
      </Box>
    </FormSheetScreen>
  )
}

export default BibleVerseLinks

import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'

import BibleLinkItem from './BibleLinkItem'
import BibleLinksSettingsModal from './BibleLinksSettingsModal'
import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Header from '~common/Header'
import Empty from '~common/Empty'

import FiltersHeader from '~common/FiltersHeader'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { unifiedTagsModalAtom } from '~state/app'
import verseToReference from '~helpers/verseToReference'
import { Tag } from '~common/types'
import { Link } from '~redux/modules/user'
import {
  selectLinks,
  selectRelationCountsByEndpointIdentity,
  selectRelations,
} from '~redux/selectors/bible'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'

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
  const router = useRouter()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : withBack
  const hasListBackButton = isFormSheet ? canGoBackInStack : true

  const [title, setTitle] = useState('')
  const [links, setLinks] = useState<TLink[]>([])
  const [selectedChip, setSelectedChip] = useState<Tag | null>(null)
  const [linkSettingsId, setLinkSettingsId] = useState<string | null>(null)
  const _links = useSelector(selectLinks)
  const relations = useSelector(selectRelations)
  const relationCountsByEndpoint = useSelector(selectRelationCountsByEndpointIdentity)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const linkSettingsModal = useBottomSheetModal()
  const openEntityRelations = useOpenEntityRelations()

  const openTagsModal = useCallback(() => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag: selectedChip ?? undefined,
      onSelect: (tag?: Tag) => setSelectedChip(tag ?? null),
    })
  }, [selectedChip, setUnifiedTagsModal])

  const openLinkSettings = (linkId: string) => {
    setLinkSettingsId(linkId)
    linkSettingsModal.open()
  }

  const getLinkEndpoint = (
    linkId: string
  ): Extract<RelationEndpoint, { type: 'externalLink' }> | null => {
    const link = _links[linkId]
    if (!link) return null

    return {
      type: 'externalLink',
      linkId,
      sourceKey: '',
      url: link.url,
      label: link.customTitle || link.ogData?.title || link.url,
    }
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
    router.push({ pathname: '/link', params: { linkId } })
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

  const filteredLinks = links.filter(s =>
    selectedChip ? s.link.tags && s.link.tags[selectedChip.id] : true
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
            hasActiveFilters={Boolean(selectedChip)}
            onReset={() => setSelectedChip(null)}
            filters={[
              {
                key: 'tags',
                icon: 'tag',
                label: t('Tags'),
                value: selectedChip?.name || t('Tous'),
                onPress: openTagsModal,
              },
            ]}
          />
        )}
        {filteredLinks.length ? (
          <FlatList
            data={filteredLinks}
            renderItem={renderLink}
            keyExtractor={(item: TLink, index: number) => index.toString()}
            style={{ paddingBottom: 30 }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/link.svg')}
            message={t("Vous n'avez pas encore de liens...")}
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

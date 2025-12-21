import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { StackScreenProps } from '@react-navigation/stack'

import BibleLinkModal from './BibleLinkModal'
import BibleLinkItem from './BibleLinkItem'
import BibleLinksSettingsModal from './BibleLinksSettingsModal'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import Header from '~common/Header'
import Empty from '~common/Empty'

import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import verseToReference from '~helpers/verseToReference'
import { MainStackProps } from '~navigation/type'
import { Tag, VerseIds } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import { Link } from '~redux/modules/user'

type TLink = {
  linkId: string
  reference: string
  link: Link
}

const BibleVerseLinks = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'BibleVerseLinks'>) => {
  const { withBack, verse } = route.params || {}
  const { t } = useTranslation()

  const [title, setTitle] = useState('')
  const [links, setLinks] = useState<TLink[]>([])
  const [linkVerses, setLinkVerses] = useState<VerseIds | undefined>(undefined)
  const [isTagsOpen, setIsTagsOpen] = useState(false)
  const [selectedChip, setSelectedChip] = useState<Tag | undefined>(undefined)
  const [linkSettingsId, setLinkSettingsId] = useState<string | null>(null)
  const _links = useSelector((state: RootState) => state.user.bible.links)

  useEffect(() => {
    loadPage()
  }, [verse, _links])

  const loadPage = async () => {
    const { verse } = route.params || {}
    let title
    const filtered_links: TLink[] = []

    if (verse) {
      title = verseToReference(verse)
      title = `${t('Liens sur')} ${title}...`
    } else {
      title = t('Liens')
    }

    await Promise.all(
      Object.entries(_links)
        .filter(link => {
          if (verse) {
            const firstVerseRef = link[0].split('/')[0]
            return firstVerseRef === verse
          }
          return true
        })
        .map(link => {
          const verseNumbers: any = {}
          link[0].split('/').map(ref => {
            verseNumbers[ref] = true
          })

          const reference = verseToReference(verseNumbers)
          filtered_links.push({ linkId: link[0], reference, link: link[1] })
        })
    )

    setTitle(title)
    setLinks(filtered_links)
  }

  const openLinkModal = (linkId: string) => {
    const linkVerses = linkId.split('/').reduce((accuRefs, key) => {
      accuRefs[key] = true
      return accuRefs
    }, {} as any)

    setLinkVerses(linkVerses)
  }

  const closeTags = () => setIsTagsOpen(false)
  const closeLinkSettings = () => setLinkSettingsId(null)

  const renderLink = ({ item, index }: { item: TLink; index: number }) => {
    return (
      <BibleLinkItem
        key={index}
        item={item}
        onPress={openLinkModal}
        onMenuPress={setLinkSettingsId}
      />
    )
  }

  const filteredLinks = links.filter(s =>
    selectedChip ? s.link.tags && s.link.tags[selectedChip.id] : true
  )

  const selectedLink = links.find(link => link.linkId === linkSettingsId)

  return (
    <Container>
      {verse ? (
        <Header hasBackButton={withBack} title={title || t('Chargement...')} />
      ) : (
        <TagsHeader
          title={t('Liens')}
          setIsOpen={setIsTagsOpen}
          isOpen={isTagsOpen}
          selectedChip={selectedChip}
          hasBackButton
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
          source={require('~assets/images/empty.json')}
          message={t("Vous n'avez pas encore de liens...")}
        />
      )}
      <BibleLinkModal linkVerses={linkVerses} />
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={closeTags}
        onSelected={(chip: Tag) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <BibleLinksSettingsModal
        title={selectedLink?.link.ogData?.title || selectedLink?.link.customTitle || ''}
        linkId={linkSettingsId}
        onClosed={closeLinkSettings}
      />
    </Container>
  )
}

export default BibleVerseLinks

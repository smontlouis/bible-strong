import React, { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Empty from '~common/Empty'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import Container from '~common/ui/Container'

import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import Modal from '~common/Modal'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { TagsObj } from '~common/types'
import { multipleTagsModalAtom } from '../../state/app'
import { selectAllLinks } from '~redux/selectors/bible'
import { removeLink, LinksObj, Link } from '~redux/modules/user'
import LinksList from './LinksList'
import { getLinkDisplayTitle } from '~helpers/fetchOpenGraphData'

interface Chip {
  id: string
  name: string
}

export type GroupedLink = {
  key: string
  url: string
  title: string
  linkType: string
  date: number
  versesFormatted: string
  tags: TagsObj
}

const filterByChip =
  (chipId: string, linksObj: LinksObj) =>
  ([linkId]: [string, Link]) =>
    chipId ? Boolean(linksObj[linkId].tags && linksObj[linkId].tags[chipId]) : true

const formatLinksForList = (linksObj: LinksObj): GroupedLink[] => {
  return Object.entries(linksObj)
    .sort((a, b) => Number(b[1].date) - Number(a[1].date))
    .map(([key, link]) => {
      const versesArray = key.split('/')
      const versesFormatted =
        versesArray.length > 1
          ? `${versesArray[0].split('-')[2]}-${versesArray[versesArray.length - 1].split('-')[2]}`
          : versesArray[0].split('-')[2]

      return {
        key,
        url: link.url,
        title: getLinkDisplayTitle(link),
        linkType: link.linkType || 'website',
        date: link.date,
        versesFormatted,
        tags: link.tags || {},
      }
    })
}

const LinksScreen = () => {
  const { t } = useTranslation()
  const linksObj = useSelector(selectAllLinks)

  const [isTagsOpen, setTagsIsOpen] = React.useState(false)
  const [selectedLink, setSelectedLink] = React.useState<GroupedLink | undefined>()
  const [, setMultipleTagsItem] = useAtom(multipleTagsModalAtom)
  const [selectedChip, setSelectedChip] = React.useState<Chip>()
  const dispatch = useDispatch()
  const chipId = selectedChip?.id

  const { ref, open, close } = useBottomSheetModal()

  React.useEffect(() => {
    if (selectedLink) {
      open()
    }
  }, [selectedLink, open])

  const formattedLinks = useMemo(() => {
    const links = formatLinksForList(linksObj)
    if (chipId) {
      return links.filter((_, index) => {
        const entries = Object.entries(linksObj)
        return filterByChip(chipId, linksObj)(entries[index])
      })
    }
    return links.slice(0, 100)
  }, [chipId, linksObj])

  const promptDelete = () => {
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sûr de supprimer ce lien ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          if (selectedLink) {
            dispatch(removeLink(selectedLink.key))
          }
          close()
        },
        style: 'destructive',
      },
    ])
  }

  return (
    <Container>
      <TagsHeader
        title={t('Liens')}
        setIsOpen={setTagsIsOpen}
        isOpen={isTagsOpen}
        selectedChip={selectedChip}
        hasBackButton
      />
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={() => setTagsIsOpen(false)}
        onSelected={(chip: Chip) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      {formattedLinks?.length ? (
        <LinksList
          links={formattedLinks}
          onLinkPress={link => setSelectedLink(link)}
        />
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Vous n'avez pas encore de liens enregistrés...")}
        />
      )}
      <Modal.Body ref={ref} onModalClose={() => setSelectedLink(undefined)} enableDynamicSizing>
        <Modal.Item
          bold
          onPress={() => {
            close()
            if (selectedLink) {
              setMultipleTagsItem({
                entity: 'links',
                ids: { [selectedLink.key]: true },
              })
            }
          }}
        >
          {t('Éditer les tags')}
        </Modal.Item>
        <Modal.Item bold color="quart" onPress={promptDelete}>
          {t('Supprimer')}
        </Modal.Item>
      </Modal.Body>
    </Container>
  )
}

export default LinksScreen

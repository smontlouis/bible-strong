import styled from '@emotion/native'
import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { shallowEqual, useDispatch, useSelector, useStore } from 'react-redux'

import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Modal from '~common/Modal'
import RenameModal from '~common/RenameModal'
import SearchInput from '~common/SearchInput'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import FlatList from '~common/ui/FlatList'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useFuzzy from '~helpers/useFuzzy'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { addTag, removeTag, updateTag } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'
import { makeTagDataSelector, makeGroupedHighlightsCountSelector } from '~redux/selectors/bible'
import { Tag } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import { useCreateTabGroupFromTag } from './useCreateTabGroupFromTag'

const Chip = styled(Box)(({ theme }) => ({
  borderRadius: 20,
  backgroundColor: theme.colors.border,
  paddingTop: 3,
  paddingBottom: 3,
  paddingLeft: 7,
  paddingRight: 7,
  marginRight: 5,
  marginBottom: 5,
  marginTop: 5,
}))

type TagItemProps = {
  item: Tag
  setOpen: any
}

const TagItem = ({ item, setOpen }: TagItemProps) => {
  const { t } = useTranslation()
  const selectGroupedHighlightsCount = useMemo(() => makeGroupedHighlightsCountSelector(), [])
  const highlightsNumber = useSelector((state: RootState) =>
    selectGroupedHighlightsCount(state, item.highlights)
  )
  const notesNumber = item.notes && Object.keys(item.notes).length
  const linksNumber = item.links && Object.keys(item.links).length
  const studiesNumber = item.studies && Object.keys(item.studies).length

  const strongsNumber =
    item.strongsHebreu &&
    Object.keys(item.strongsHebreu).length +
      (item.strongsGrec && Object.keys(item.strongsGrec).length)
  const wordsNumber = item.words && Object.keys(item.words).length
  const navesNumber = item.naves && Object.keys(item.naves).length

  return (
    <Box>
      <Link route="Tag" params={{ tagId: item.id }}>
        <Box padding={20} row paddingRight={0}>
          <Box flex justifyContent="center">
            <Text bold>{item.name}</Text>
            <Box row>
              {!!strongsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {strongsNumber} {t('nave', { count: strongsNumber })}
                  </Text>
                </Chip>
              )}
              {!!wordsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {wordsNumber} {t('nave', { count: wordsNumber })}
                  </Text>
                </Chip>
              )}
              {!!navesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {navesNumber} {t('nave', { count: navesNumber })}
                  </Text>
                </Chip>
              )}
              {!!highlightsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {highlightsNumber} {t('surbrillance', { count: highlightsNumber })}
                  </Text>
                </Chip>
              )}
              {!!notesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {notesNumber} {t('note', { count: notesNumber })}
                  </Text>
                </Chip>
              )}
              {!!studiesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {studiesNumber} {t('étude', { count: studiesNumber })}
                  </Text>
                </Chip>
              )}
              {!!linksNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {linksNumber} {t('lien', { count: linksNumber })}
                  </Text>
                </Chip>
              )}
            </Box>
          </Box>
          <Link onPress={() => setOpen(item)} padding>
            <FeatherIcon name="more-vertical" size={20} />
          </Link>
        </Box>
      </Link>
      <Border marginHorizontal={20} />
    </Box>
  )
}

const TagsScreen = () => {
  const { t } = useTranslation()
  const tags = useSelector(sortedTagsSelector, shallowEqual)
  const [isOpen, setOpen] = useState<Tag | undefined>(undefined)
  const renameModalRef = useRef<BottomSheetModal>(null)
  const [tagToEdit, setTagToEdit] = useState<{ id: string; name: string } | null>(null)
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })
  const dispatch = useDispatch()
  const { ref, open, close } = useBottomSheetModal()
  const store = useStore<RootState>()
  const selectTagData = useMemo(() => makeTagDataSelector(), [])
  const createTabGroupFromTag = useCreateTabGroupFromTag()

  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  const promptLogout = () => {
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer ce tag ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(removeTag(isOpen?.id))
          close()
        },
        style: 'destructive',
      },
    ])
  }

  const handleOpenInTabGroup = () => {
    if (!isOpen) return
    const tagData = selectTagData(store.getState(), isOpen)
    createTabGroupFromTag(isOpen, tagData)
    close()
  }

  return (
    <Container>
      <Header hasBackButton title={t('Étiquettes')}>
        <Box pb={10} px={20}>
          <SearchInput
            placeholder={t('Chercher une étiquette')}
            onChangeText={search}
            onDelete={resetSearch}
            value={keyword}
            returnKeyType="done"
          />
        </Box>
      </Header>
      {result.length ? (
        <FlatList
          data={result}
          renderItem={({ item }: { item: Tag }) => <TagItem setOpen={setOpen} item={item} />}
          keyExtractor={(item: Tag) => item.id}
          contentContainerStyle={{ paddingBottom: 70 }}
        />
      ) : (
        <Empty
          icon={require('~assets/images/empty-state-icons/tag.svg')}
          message={t('Aucune étiquette...')}
        />
      )}

      <Modal.Body ref={ref} onModalClose={() => setOpen(undefined)} enableDynamicSizing>
        <Modal.Item
          onPress={() => {
            if (!isOpen) return

            close()
            setTagToEdit({ id: isOpen.id, name: isOpen.name })
            renameModalRef.current?.present()
          }}
        >
          {t('Éditer')}
        </Modal.Item>
        <Modal.Item onPress={handleOpenInTabGroup}>{t('tabs.createGroupFromTag')}</Modal.Item>
        <Modal.Item color="quart" onPress={promptLogout}>
          {t('Supprimer')}
        </Modal.Item>
      </Modal.Body>
      <RenameModal
        bottomSheetRef={renameModalRef}
        title={tagToEdit?.id ? t("Renommer l'étiquette") : t('Nouvelle étiquette')}
        placeholder={t("Nom de l'étiquette")}
        initialValue={tagToEdit?.name}
        onSave={value => {
          if (tagToEdit?.id) {
            dispatch(updateTag(tagToEdit.id, value))
          } else {
            dispatch(addTag(value))
          }
        }}
      />
      {/* @ts-ignore */}
      <FabButton
        icon="plus"
        onPress={() => {
          setTagToEdit({ id: '', name: '' })
          renameModalRef.current?.present()
        }}
      />
    </Container>
  )
}

export default TagsScreen

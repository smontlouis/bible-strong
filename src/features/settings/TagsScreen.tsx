import styled from '@emotion/native'
import React, { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'

import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Modal from '~common/Modal'
import SearchInput from '~common/SearchInput'
import TitlePrompt from '~common/TitlePrompt'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import FabButton from '~common/ui/FabButton'
import FlatList from '~common/ui/FlatList'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useFuzzy from '~helpers/useFuzzy'
import { useBottomSheet } from '~helpers/useBottomSheet'
import { addTag, removeTag, updateTag } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'

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

const TagItem = ({ item, setOpen }) => {
  const { t } = useTranslation()
  const highlightsNumber =
    item.highlights && Object.keys(item.highlights).length
  const notesNumber = item.notes && Object.keys(item.notes).length
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
                    {highlightsNumber}{' '}
                    {t('surbrillance', { count: highlightsNumber })}
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
  const [isOpen, setOpen] = useState(false)
  const [titlePrompt, setTitlePrompt] = React.useState(false)
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })
  const dispatch = useDispatch()
  const { ref, open, close } = useBottomSheet()

  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  const promptLogout = () => {
    Alert.alert(
      t('Attention'),
      t('Êtes-vous vraiment sur de supprimer ce tag ?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: () => {
            dispatch(removeTag(isOpen.id))
            close()
          },
          style: 'destructive',
        },
      ]
    )
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
          renderItem={({ item }) => <TagItem setOpen={setOpen} item={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 70 }}
        />
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Aucune étiquette...')}
        />
      )}

      <Modal.Body
        ref={ref}
        onModalClose={() => setOpen(false)}
        enableDynamicSizing
      >
        <Modal.Item
          bold
          onPress={() => {
            close()
            setTitlePrompt({ id: isOpen.id, name: isOpen.name })
          }}
        >
          {t('Éditer')}
        </Modal.Item>
        <Modal.Item bold color="quart" onPress={promptLogout}>
          {t('Supprimer')}
        </Modal.Item>
      </Modal.Body>
      <TitlePrompt
        placeholder={t("Nom de l'étiquette")}
        isOpen={!!titlePrompt}
        title={titlePrompt.name}
        onClosed={() => setTitlePrompt(false)}
        onSave={value => {
          if (titlePrompt.id) {
            dispatch(updateTag(titlePrompt.id, value))
          } else {
            dispatch(addTag(value))
          }
        }}
      />
      <FabButton
        icon="add"
        onPress={() => {
          setTitlePrompt(true)
        }}
      />
    </Container>
  )
}

export default TagsScreen

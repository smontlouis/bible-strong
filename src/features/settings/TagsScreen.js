import React, { useState } from 'react'
import { Alert } from 'react-native'
import styled from '@emotion/native'
import { useSelector, useDispatch } from 'react-redux'
import * as Icon from '@expo/vector-icons'

import FabButton from '~common/ui/FabButton'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import Modal from '~common/Modal'
import Link from '~common/Link'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'
import TitlePrompt from '~common/TitlePrompt'
import { addTag, updateTag, removeTag } from '~redux/modules/user'

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
      <Link route="Tag" params={{ item }}>
        <Box padding={20} row paddingRight={0}>
          <Box flex justifyContent="center">
            <Text bold>{item.name}</Text>
            <Box row>
              {!!strongsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {strongsNumber} {`strong${highlightsNumber > 1 ? 's' : ''}`}
                  </Text>
                </Chip>
              )}
              {!!wordsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {wordsNumber} {`mot${wordsNumber > 1 ? 's' : ''}`}
                  </Text>
                </Chip>
              )}
              {!!navesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {navesNumber} {`nave${navesNumber > 1 ? 's' : ''}`}
                  </Text>
                </Chip>
              )}
              {!!highlightsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {highlightsNumber}{' '}
                    {`surbrillance${highlightsNumber > 1 ? 's' : ''}`}
                  </Text>
                </Chip>
              )}
              {!!notesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {notesNumber} {`note${notesNumber > 1 ? 's' : ''}`}
                  </Text>
                </Chip>
              )}
              {!!studiesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {studiesNumber} {`étude${studiesNumber > 1 ? 's' : ''}`}
                  </Text>
                </Chip>
              )}
            </Box>
          </Box>
          <Link onPress={() => setOpen(item)} padding>
            <Icon.Feather name="more-vertical" size={20} />
          </Link>
        </Box>
      </Link>
      <Border marginHorizontal={20} />
    </Box>
  )
}

const TagsScreen = () => {
  const tags = useSelector(state => Object.values(state.user.bible.tags))
  const [isOpen, setOpen] = useState(false)
  const [titlePrompt, setTitlePrompt] = React.useState(false)

  const dispatch = useDispatch()

  const promptLogout = () => {
    Alert.alert('Attention', 'Êtes-vous vraiment sur de supprimer ce tag ?', [
      { text: 'Non', onPress: () => null, style: 'cancel' },
      {
        text: 'Oui',
        onPress: () => {
          dispatch(removeTag(isOpen.id))
          setOpen(false)
        },
        style: 'destructive',
      },
    ])
  }

  return (
    <Container>
      <Header hasBackButton title="Étiquettes" />
      {tags.length ? (
        <FlatList
          data={tags}
          renderItem={({ item }) => <TagItem setOpen={setOpen} item={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 70 }}
        />
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message="Aucune étiquette..."
        />
      )}

      <Modal.Menu isOpen={!!isOpen} onClosed={() => setOpen(false)}>
        <Modal.Item
          bold
          onPress={() => {
            setOpen(false)
            setTimeout(() => {
              setTitlePrompt({ id: isOpen.id, name: isOpen.name })
            }, 500)
          }}
        >
          Éditer
        </Modal.Item>
        <Modal.Item bold color="quart" onPress={promptLogout}>
          Supprimer
        </Modal.Item>
      </Modal.Menu>
      <TitlePrompt
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
        align="flex-end"
      />
    </Container>
  )
}

export default TagsScreen

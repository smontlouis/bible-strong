import React, { useState, useEffect } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { withNavigation } from 'react-navigation'
import compose from 'recompose/compose'
import * as Icon from '@expo/vector-icons'

import getVersesRef from '~helpers/getVersesRef'
import formatVerseContent from '~helpers/formatVerseContent'
import waitForTresorModal from '~common/waitForTresorModal'
import Empty from '~common/Empty'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import loadTresorReferences from '~helpers/loadTresorReferences'
import { hp } from '~helpers/utils'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  zIndex: 10,
  margin: 0
})

const IconFeather = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const Container = styled.View(({ theme }) => ({
  height: hp(60),
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.2,
  shadowRadius: 7,
  elevation: 2,
  paddingBottom: getBottomSpace(),
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30
}))

const ReferenceItem = ({ reference, version }) => {
  const [Verse, setVerse] = useState(null)

  useEffect(() => {
    const loadVerse = async () => {
      const verse = await getVersesRef(reference, version)
      setVerse(verse)
    }
    loadVerse()
  }, [reference, version])

  if (!Verse) {
    return null
  }

  const [book, chapter, verse] = reference.split('-').map(Number)

  return (
    <Link
      route="BibleView"
      params={{
        isReadOnly: true,
        book,
        chapter,
        verse
      }}>
      <Box marginBottom={30}>
        <Text title fontSize={14}>
          {Verse.title}
        </Text>
        <Paragraph scale={-2} scaleLineHeight={-1}>
          {Verse.content}
        </Paragraph>
      </Box>
    </Link>
  )
}

const CardWrapper = waitForTresorModal(({ theme, selectedVerse, onClosed, version }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [references, setReferences] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadRef = async () => {
      if (selectedVerse) {
        setError(false)
        setIsLoading(true)
        const references = await loadTresorReferences(selectedVerse)
        setReferences(references)

        if (references?.error || !references) {
          setError(true)
          setIsLoading(false)
          return
        }

        setIsLoading(false)
      }
    }

    loadRef()
  }, [selectedVerse])

  if (error) {
    return (
      <Empty source={require('~assets/images/empty.json')} message="Une erreur est survenue..." />
    )
  }

  if (isLoading) {
    return (
      <Box flex center>
        <ActivityIndicator color={theme.colors.grey} />
      </Box>
    )
  }

  if (!selectedVerse) {
    return null
  }

  const { title } = formatVerseContent([selectedVerse])
  const renderReferences = () => {
    const refs = references.commentaires ? JSON.parse(references.commentaires) : []
    return refs.map((ref, i) => {
      const splittedRef = ref.split('-')
      if (splittedRef.length === 3) {
        return <ReferenceItem key={ref + i} reference={ref} version={version} />
      }

      return (
        <Text title key={ref} fontSize={20} marginBottom={5} color="lightPrimary">
          {splittedRef}
        </Text>
      )
    })
  }

  return (
    <Box flex>
      <Box row height={60} alignItems="center">
        <Box flex paddingLeft={20}>
          <Text title fontSize={16} marginTop={10}>
            {title}
          </Text>
          <Text fontSize={13} color="grey">
            Références croisées{' '}
          </Text>
        </Box>
        <Link onPress={onClosed} padding>
          <IconFeather name="x" size={25} />
        </Link>
      </Box>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        {renderReferences()}
      </ScrollView>
    </Box>
  )
})

const ReferenceModal = ({ onClosed, theme, selectedVerse, version }) => {
  return (
    <StylizedModal
      backdropOpacity={0.3}
      coverScreen={false}
      isVisible={!!selectedVerse}
      onBackdropPress={onClosed}
      onBackButtonPress={onClosed}>
      <Container>
        <CardWrapper {...{ theme, selectedVerse, onClosed, version }} />
      </Container>
    </StylizedModal>
  )
}

export default compose(withNavigation)(ReferenceModal)

// TODO - SPLIT THIS :(

import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { withNavigation } from 'react-navigation'

import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Modalize } from 'react-native-modalize'
import Empty from '~common/Empty'
import Link from '~common/Link'
import Modal from '~common/Modal'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import waitForTresorModal from '~common/waitForTresorModal'
import formatVerseContent from '~helpers/formatVerseContent'
import getVersesRef from '~helpers/getVersesRef'
import loadTresorReferences from '~helpers/loadTresorReferences'
import { timeout } from '~helpers/timeout'

const IconFeather = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const ReferenceItem = ({ reference, version, onClosed }) => {
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
      onPress={onClosed}
      params={{
        isReadOnly: true,
        book,
        chapter,
        verse,
      }}
    >
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

const CardWrapper = waitForTresorModal(
  ({ theme, selectedVerse, onClosed, version }) => {
    const [isLoading, setIsLoading] = useState(true)
    const [references, setReferences] = useState(null)
    const [error, setError] = useState(false)

    useEffect(() => {
      const loadRef = async () => {
        if (selectedVerse) {
          setError(false)
          setIsLoading(true)
          await timeout(500)
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
        <Empty
          source={require('~assets/images/empty.json')}
          message="Une erreur est survenue..."
        />
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

    return (
      <Box flex>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <References
            references={references}
            version={version}
            onClosed={onClosed}
          />
        </ScrollView>
      </Box>
    )
  }
)

const References = ({ references, version, onClosed }) => {
  const refs = references.commentaires
    ? JSON.parse(references.commentaires)
    : []

  if (!refs.length) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message="Aucune référence pour ce verset..."
      />
    )
  }

  return refs.map((ref, i) => {
    const splittedRef = ref.split('-')
    if (splittedRef.length === 3) {
      return (
        <ReferenceItem
          key={ref + i}
          reference={ref}
          version={version}
          onClosed={onClosed}
        />
      )
    }

    return (
      <Text title key={ref} fontSize={20} marginBottom={5} color="lightPrimary">
        {splittedRef}
      </Text>
    )
  })
}

const ReferenceModal = ({ onClosed, selectedVerse, version }) => {
  const { title } = formatVerseContent([selectedVerse])
  const { t } = useTranslation()
  const theme = useTheme()
  const ref = React.useRef<Modalize>(null)

  return (
    <Modal.Body
      isOpen={!!selectedVerse}
      onClose={onClosed}
      modalRef={ref}
      HeaderComponent={
        <Box row height={60} alignItems="center">
          <Box flex paddingLeft={20}>
            <Text title fontSize={16} marginTop={10}>
              {title}
            </Text>
            <Text fontSize={13} color="grey">
              {t('Références croisées')}
            </Text>
          </Box>
          <Link onPress={() => ref?.current?.close()} padding>
            <IconFeather name="x" size={20} />
          </Link>
        </Box>
      }
    >
      <CardWrapper {...{ theme, selectedVerse, onClosed, version }} />
    </Modal.Body>
  )
}

export default withNavigation(ReferenceModal)

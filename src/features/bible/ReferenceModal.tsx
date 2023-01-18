// TODO - SPLIT THIS :(

import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { withNavigation } from 'react-navigation'

import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Link from '~common/Link'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import waitForTresorModal from '~common/waitForTresorModal'
import formatVerseContent from '~helpers/formatVerseContent'
import getVersesRef from '~helpers/getVersesRef'
import loadTresorReferences from '~helpers/loadTresorReferences'
import { timeout } from '~helpers/timeout'
import { useModalize } from '~helpers/useModalize'

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
          <References references={references} version={version} />
        </ScrollView>
      </Box>
    )
  }
)

const References = ({ references, version }) => {
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
    if (splittedRef.length === 3 && splittedRef[0] > 0) {
      return <ReferenceItem key={ref + i} reference={ref} version={version} />
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
  const { ref, open, close } = useModalize()

  useEffect(() => {
    if (selectedVerse) {
      open()
    }
  }, [selectedVerse, open])

  return (
    <Modal.Body
      ref={ref}
      onClose={onClosed}
      modalRef={ref}
      HeaderComponent={
        <ModalHeader
          onClose={() => ref?.current?.close()}
          title={title}
          subTitle={t('Références croisées')}
        />
      }
    >
      <CardWrapper {...{ theme, selectedVerse, onClosed: close, version }} />
    </Modal.Body>
  )
}

export default withNavigation(ReferenceModal)

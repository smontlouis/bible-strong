// TODO - SPLIT THIS :(

import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'

import { useTheme } from '@emotion/react'
import { useQuery } from '~helpers/react-query-lite'
import Empty from '~common/Empty'
import Link from '~common/Link'
import { VerseRefContent } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import waitForTresorModal from '~common/waitForTresorModal'
import getVersesContent from '~helpers/getVersesContent'
import loadTresorReferences from '~helpers/loadTresorReferences'
import { VersionCode } from '../../state/tabs'

const ReferenceItem = ({
  reference,
  version,
}: {
  reference: string
  version: VersionCode
}) => {
  const [Verse, setVerse] = useState<VerseRefContent | null>(null)

  useEffect(() => {
    const loadVerse = async () => {
      const verse = await getVersesContent({ verses: reference, version })
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

export const ReferenceCard = waitForTresorModal(
  ({
    selectedVerse,
    version,
  }: {
    selectedVerse: string
    version: VersionCode
  }) => {
    const theme = useTheme()

    const { isLoading, error, data } = useQuery({
      queryKey: ['references', selectedVerse],
      queryFn: () => loadTresorReferences(selectedVerse),
    })

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
        <Box flex center minH={200}>
          <ActivityIndicator color={theme.colors.grey} />
        </Box>
      )
    }

    if (!selectedVerse || !data) {
      return null
    }

    return (
      <Box flex padding={20}>
        <References references={data} version={version} />
      </Box>
    )
  }
)

const References = ({
  references,
  version,
}: {
  references: any
  version: VersionCode
}) => {
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

  return (
    <ScrollView>
      {refs.map((ref, i) => {
        const splittedRef = ref.split('-')
        if (splittedRef.length === 3 && splittedRef[0] > 0) {
          return (
            <ReferenceItem key={ref + i} reference={ref} version={version} />
          )
        }

        return (
          <Text
            title
            key={ref}
            fontSize={20}
            marginBottom={5}
            color="lightPrimary"
          >
            {splittedRef}
          </Text>
        )
      })}
    </ScrollView>
  )
}

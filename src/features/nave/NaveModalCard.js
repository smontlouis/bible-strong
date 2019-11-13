import React, { useState, useEffect } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import { timeout } from '~helpers/timeout'
import formatVerseContent from '~helpers/formatVerseContent'
import waitForNaveModal from '~features/home/waitForNaveWidget'
import Empty from '~common/Empty'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import NaveForVerse from './NaveModalForVerse'
import loadNaveByVerset from '~helpers/loadNaveByVerset'

const IconFeather = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const CardWrapper = waitForNaveModal(({ theme, selectedVerse, onClosed }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [Naves, setNaves] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadRef = async () => {
      if (selectedVerse) {
        setError(false)
        setIsLoading(true)
        await timeout(500)
        const Naves = await loadNaveByVerset(selectedVerse)
        setNaves(Naves)

        if (Naves?.error || !Naves) {
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
  const [naveItemsForVerse, naveItemsForChapter] = Naves || []

  return (
    <Box flex>
      <Box row height={60} alignItems="center">
        <Box flex paddingLeft={20}>
          <Text title fontSize={16} marginTop={10}>
            {title}
          </Text>
          <Text fontSize={13} color="grey">
            Par thèmes{' '}
          </Text>
        </Box>
        <Link onPress={onClosed} padding>
          <IconFeather name="x" size={25} />
        </Link>
      </Box>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        {(!!naveItemsForChapter || !!naveItemsForVerse) && (
          <>
            <NaveForVerse
              items={naveItemsForVerse}
              label="Concernant le verset"
              onClosed={onClosed}
            />
            <NaveForVerse
              items={naveItemsForChapter}
              label="Concernant le chapitre entier"
              onClosed={onClosed}
            />
          </>
        )}
      </ScrollView>
    </Box>
  )
})

export default CardWrapper

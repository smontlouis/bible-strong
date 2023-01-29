import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import waitForNaveDB from '~common/waitForNaveDB'
import loadNaveByVerset from '~helpers/loadNaveByVerset'
import { timeout } from '~helpers/timeout'
import NaveForVerse from './NaveModalForVerse'

const CardWrapper = waitForNaveDB()(({ theme, selectedVerse, onClosed }) => {
  const { t } = useTranslation()
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
      <Empty
        source={require('~assets/images/empty.json')}
        message={t('Une erreur est survenue...')}
      />
    )
  }

  if (isLoading) {
    return (
      <Box flex center height={150}>
        <ActivityIndicator color={theme.colors.grey} />
      </Box>
    )
  }

  if (!selectedVerse) {
    return null
  }

  const [naveItemsForVerse, naveItemsForChapter] = Naves || []

  return (
    <Box padding={20}>
      {(!!naveItemsForChapter || !!naveItemsForVerse) && (
        <>
          <NaveForVerse
            items={naveItemsForVerse}
            label={t('Concernant le verset')}
            onClosed={onClosed}
          />
          <NaveForVerse
            items={naveItemsForChapter}
            label={t('Concernant le chapitre entier')}
            onClosed={onClosed}
          />
        </>
      )}
    </Box>
  )
})

export default CardWrapper

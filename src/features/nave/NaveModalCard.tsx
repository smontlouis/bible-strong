import { useTheme } from '@emotion/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView } from 'react-native'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import waitForNaveDB from '~common/waitForNaveDB'
import loadNaveByVerset from '~helpers/loadNaveByVerset'
import { useQuery } from '~helpers/react-query-lite'
import NaveForVerse from './NaveModalForVerse'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'

type Props = {
  selectedVerse: string
}

const NaveModalCard = waitForNaveDB()(({ selectedVerse }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()

  const { isLoading, error, data } = useQuery({
    queryKey: ['nave', selectedVerse],
    queryFn: () => loadNaveByVerset(selectedVerse),
  })

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

  const [naveItemsForVerse, naveItemsForChapter] = data || []

  return (
    <BottomSheetScrollView>
      <Box padding={20}>
        {(!!naveItemsForChapter || !!naveItemsForVerse) && (
          <>
            <NaveForVerse
              items={naveItemsForVerse}
              label={t('Concernant le verset')}
            />
            <NaveForVerse
              items={naveItemsForChapter}
              label={t('Concernant le chapitre entier')}
            />
          </>
        )}
      </Box>
    </BottomSheetScrollView>
  )
})

export default NaveModalCard

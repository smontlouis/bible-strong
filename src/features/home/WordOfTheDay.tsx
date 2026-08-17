import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { useTranslation } from 'react-i18next'
import DictionnaireIcon from '~common/DictionnaryIcon'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useLanguage from '~helpers/useLanguage'
import RandomButton from './RandomButton'
import { WidgetContainer, WidgetLoading, itemHeight } from './widget'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { ResourceAccessError } from '~features/resources/resourceAccessError'
import ResourceDownloadWidget from './ResourceDownloadWidget'
import useConnection from '~helpers/useConnection'

function randomIntFromInterval(min: number, max: number) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const DictionnaireOfTheDay = ({ color1 = 'rgba(86,204,242,1)', color2 = 'rgba(47,128,237,1)' }) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const lang = useLanguage()
  const isConnected = useConnection()
  const [randomSeed, setRandomSeed] = useState(0)
  const availabilityQuery = useQuery({
    queryKey: [...resourceQueryKeys.offlineDatabaseAvailability('DICTIONNAIRE', lang), isConnected],
    queryFn: () =>
      resources.dictionary.getAvailability?.(lang) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const strongQuery = useQuery({
    queryKey: ['home-dictionary-random', lang, randomSeed, isConnected],
    queryFn: async () =>
      (await resources.dictionary.loadItemByRowId(
        lang === 'fr' ? randomIntFromInterval(5437, 10872) : randomIntFromInterval(1, 8620),
        lang
      )) ?? null,
    ...localQueryOptions,
  })
  const strongReference = strongQuery.data

  if (
    availabilityQuery.data?.status === 'unavailable' ||
    (strongQuery.error instanceof ResourceAccessError &&
      strongQuery.error.recoveries.includes('acquire-offline-copy'))
  ) {
    return (
      <ResourceDownloadWidget
        identity={{ kind: 'database', databaseId: 'DICTIONNAIRE', language: lang }}
        title={t('resource.dictionary.offlineCopyNeeded')}
        fileSize={22}
      />
    )
  }

  if (strongQuery.isError || (strongQuery.isSuccess && !strongReference)) {
    return (
      <WidgetContainer>
        <FeatherIcon name="x" size={30} color="quart" />
        <Text marginTop={5}>{t('Une erreur est survenue.')}</Text>
      </WidgetContainer>
    )
  }

  if (strongQuery.isPending || !strongReference) {
    return <WidgetLoading />
  }

  const { word } = strongReference

  return (
    <Link route="DictionnaryDetail" params={{ word }}>
      <WidgetContainer>
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: itemHeight,
            borderRadius: 3,
          }}
        >
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height: itemHeight }}
            colors={[color1, color2]}
          />
        </Box>
        <RandomButton onPress={() => setRandomSeed(seed => seed + 1)} />
        <Box flex={1} center>
          <Paragraph mt={20} scale={-2} color="white" scaleLineHeight={-2}>
            {word}
          </Paragraph>
        </Box>
        <Link route="Dictionnaire" style={{ width: '100%' }}>
          <Box row center backgroundColor="rgba(0,0,0,0.04)" paddingVertical={10}>
            <DictionnaireIcon style={{ marginRight: 10 }} size={20} color="white" />
            <Text color="white" bold fontSize={12}>
              {t('Dictionnaire W.')}
            </Text>
          </Box>
        </Link>
      </WidgetContainer>
    </Link>
  )
}

export default DictionnaireOfTheDay

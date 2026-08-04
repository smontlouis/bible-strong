import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import NaveIcon from '~common/NaveIcon'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import RandomButton from './RandomButton'
import { WidgetContainer, WidgetLoading, itemHeight } from './widget'
import { localQueryOptions } from '~helpers/queryOptions'
import { useResourceLanguage } from '~state/resourcesLanguage'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { ResourceAccessError } from '~features/resources/resourceAccessError'

const NaveOfTheDay = ({ color1 = 'rgb(80, 83, 140)', color2 = 'rgb(48, 51, 107)' }) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const [resourceLanguage] = useResourceLanguage('NAVE')
  const [randomSeed, setRandomSeed] = useState(0)
  const availabilityQuery = useQuery({
    queryKey: resourceQueryKeys.offlineDatabaseAvailability('NAVE', resourceLanguage),
    queryFn: () =>
      resources.nave.getAvailability?.(resourceLanguage) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const naveQuery = useQuery({
    queryKey: ['home-nave-random', randomSeed],
    queryFn: async () => (await resources.nave.loadRandom()) ?? null,
    ...localQueryOptions,
  })
  const naveReference = naveQuery.data

  if (
    availabilityQuery.data?.status === 'unavailable' ||
    (naveQuery.error instanceof ResourceAccessError &&
      naveQuery.error.recoveries.includes('acquire-offline-copy'))
  ) {
    return null
  }

  if (naveQuery.isError || (naveQuery.isSuccess && !naveReference)) {
    return (
      <WidgetContainer>
        <FeatherIcon name="x" size={30} color="quart" />
        <Text marginTop={5}>{t('Une erreur est survenue.')}</Text>
      </WidgetContainer>
    )
  }

  if (naveQuery.isPending || !naveReference) {
    return <WidgetLoading />
  }

  const { name, normalizedName } = naveReference

  return (
    <Link route="NaveDetail" params={{ name, name_lower: normalizedName }}>
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
        <Box flex={1} center mt={20}>
          <Paragraph style={{ color: 'white' }} scale={-2} scaleLineHeight={-2}>
            {name}
          </Paragraph>
        </Box>
        <Link route="Nave" style={{ width: '100%' }}>
          <Box row center backgroundColor="rgba(0,0,0,0.1)" paddingVertical={10}>
            <NaveIcon style={{ marginRight: 10 }} size={20} color="white" />
            <Text color="white" bold fontSize={12}>
              {t('Thèmes Nave')}
            </Text>
          </Box>
        </Link>
      </WidgetContainer>
    </Link>
  )
}

export default NaveOfTheDay

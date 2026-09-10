import ResourceDiscoveryEntry from './ResourceDiscoveryEntry'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LexiqueIcon from '~common/LexiqueIcon'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import truncate from '~helpers/truncate'
import RandomButton from './RandomButton'
import { WidgetContainer, WidgetLoading, itemHeight } from './widget'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import { localQueryOptions } from '~helpers/queryOptions'
import { useAtomValue } from 'jotai/react'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromStrongModuleAvailability,
} from '~features/resources/resourceFailure'
import ResourceDownloadWidget from './ResourceDownloadWidget'
type StrongOfTheDayProps = {
  type: 'grec' | 'hebreu'
  discovery?: boolean
  color1?: string
  color2?: string
}

const StrongOfTheDay = ({
  type,
  discovery = false,
  color1 = 'rgb(69,150,220)',
  color2 = 'rgb(89,131,240)',
}: StrongOfTheDayProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const resources = useResourceAccess()
  const resourceLanguage = useAtomValue(resourcesLanguageAtom).STRONG
  const isConnected = useConnection()
  const resourceTitle = t('Lexique Strong')

  const [randomSeed, setRandomSeed] = useState(0)
  const availabilityQuery = useQuery({
    queryKey: [...resourceQueryKeys.strongLexiconAvailability('core'), isConnected],
    queryFn: async () => ({
      availability: await resources.strongLexicon.getModuleAvailability('core'),
      recoveries: await resources.strongLexicon.getModuleRecoveryActions?.('core'),
    }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const strongQuery = useQuery({
    queryKey: ['home-strong-random', type, resourceLanguage, randomSeed, isConnected],
    queryFn: async (): Promise<StrongLexiconSearchResult | null> =>
      (await resources.strongLexicon.random(
        type === 'grec' ? 'greek' : 'hebrew',
        resourceLanguage
      )) ?? null,
    ...localQueryOptions,
  })
  const strongReference = strongQuery.data
  if (availabilityQuery.isError) {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          title={resourceTitle}
          failure={resourceFailureFromAccessError(availabilityQuery.error)}
          size="small"
          onRetry={() => void availabilityQuery.refetch()}
        />
      </WidgetContainer>
    )
  }
  if (
    availabilityQuery.data &&
    ['missing', 'core-missing'].includes(availabilityQuery.data.availability.status)
  ) {
    return (
      <ResourceDownloadWidget
        identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
        title={resourceTitle}
        fileSize={35}
        onRetry={() => {
          void availabilityQuery.refetch()
          void strongQuery.refetch()
        }}
      />
    )
  }
  if (availabilityQuery.data && availabilityQuery.data.availability.status !== 'available') {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
          title={resourceTitle}
          fileSize={35}
          failure={resourceFailureFromStrongModuleAvailability(
            availabilityQuery.data.availability,
            availabilityQuery.data.recoveries
          )}
          size="small"
        />
      </WidgetContainer>
    )
  }
  const error = strongQuery.isError
    ? true
    : strongQuery.isSuccess && !strongReference
      ? 'NOT_FOUND'
      : false

  if (error) {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
          title={resourceTitle}
          fileSize={35}
          failure={
            error === 'NOT_FOUND'
              ? { cause: 'not-found', recoveries: [] }
              : resourceFailureFromAccessError(strongQuery.error)
          }
          size="small"
          onRetry={() => void strongQuery.refetch()}
        />
      </WidgetContainer>
    )
  }

  if (strongQuery.isPending || !strongReference) {
    return <WidgetLoading />
  }

  const { original, gloss, stepCode, language } = strongReference
  const book = language === 'greek' ? 40 : 1

  if (discovery)
    return (
      <ResourceDiscoveryEntry
        original={original}
        title={gloss}
        detail={{ route: 'Strong', params: { book, reference: stepCode } }}
        isRefreshing={strongQuery.isFetching}
        onShuffle={() => void strongQuery.refetch()}
      />
    )

  return (
    <Link route="Strong" params={{ book, reference: stepCode }}>
      <WidgetContainer>
        <Box
          className="overflow-hidden border-continuous"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: itemHeight,
            borderRadius: 3,
          }}
        >
          <LinearGradient start={[0.1, 0.2]} style={{ height: 130 }} colors={[color1, color2]} />
        </Box>
        <RandomButton onPress={() => setRandomSeed(seed => seed + 1)} />
        <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center mt-[20px]">
          <Box className="overflow-hidden border-continuous bg-[rgba(0,0,0,0.1)] px-[5px] py-[3px] rounded-[20px]">
            <Text className="text-[10px]" style={{ color: 'white' }}>
              {type === 'grec' ? t('Grec') : t('Hébreu')}
            </Text>
          </Box>
          <Paragraph
            scale={-2}
            style={[
              { fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) },
              { color: 'white' },
            ]}
          >
            {truncate(gloss, 10)}
          </Paragraph>
          <Paragraph
            className="mb-[3px]"
            style={{ color: 'white', opacity: 0.5 }}
            scale={-3}
            scaleLineHeight={-2}
          >
            {truncate(original, 10)}
          </Paragraph>
        </Box>
        <Link route="Lexique" style={{ width: '100%' }}>
          <Box className="overflow-hidden border-continuous flex-row items-center justify-center bg-[rgba(0,0,0,0.04)] py-[10px]">
            <LexiqueIcon style={{ marginRight: 10 }} size={20} color="white" />
            <Text className="text-[white] font-bold text-[12px]">{t('Lexique')}</Text>
          </Box>
        </Link>
      </WidgetContainer>
    </Link>
  )
}

export default StrongOfTheDay

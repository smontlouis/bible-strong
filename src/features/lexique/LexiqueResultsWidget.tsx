import React, { useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'

import { useResultsByLetterOrSearch } from './useUtilities'
import LexiqueResultItem from './LexiqueResultItem'
import { useAtomValue } from 'jotai/react'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'

const LIMIT = 5
const height = 40

interface LexiqueResultsWidgetProps {
  searchValue: string
}

const LexiqueResultsWidget = ({ searchValue }: LexiqueResultsWidgetProps) => {
  const resources = useResourceAccess()
  const resourceLanguage = useAtomValue(resourcesLanguageAtom).STRONG
  const [limit, setLimit] = useState(LIMIT)

  const { results, error } = useResultsByLetterOrSearch({
    queryKey: ['strong-lexicon'],
    query: value => resources.strongLexicon.search(value, resourceLanguage, 200),
    value: searchValue,
    resourceLanguage,
  })

  if (error) {
    return null
  }

  const lexiqueResults = Array.isArray(results) ? results : []

  if (!lexiqueResults.length) {
    return null
  }

  return (
    <>
      {lexiqueResults.slice(0, limit).map((strong: StrongLexiconSearchResult) => {
        const variant = strong.language === 'greek' ? 'grec' : 'hebreu'
        return (
          <LexiqueResultItem
            key={`${strong.id}:${strong.stepCode}`}
            displayCode={strong.stepCode}
            reference={strong.stepCode}
            title={strong.gloss}
            variant={variant}
          />
        )
      })}
      {lexiqueResults.length > limit && (
        <Link onPress={() => setLimit(l => l + 5)}>
          <Box
            opacity={0.5}
            center
            borderRadius={8}
            marginRight={10}
            marginBottom={10}
            height={height}
            paddingHorizontal={10}
          >
            <Box
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height,
                borderRadius: 3,
              }}
            >
              <LinearGradient
                start={[0.1, 0.2]}
                style={{ height }}
                colors={['rgba(248,131,121,1)', 'rgba(255,77,93,1)']}
              />
            </Box>
            <Text title fontSize={14} style={{ color: 'white' }}>
              + {lexiqueResults.length - limit}
            </Text>
          </Box>
        </Link>
      )}
    </>
  )
}

export default LexiqueResultsWidget

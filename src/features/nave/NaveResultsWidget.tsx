import React, { useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { NaveTopicSummary } from '~features/resources/naveAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'

import { useResultsByLetterOrSearch } from '../lexique/useUtilities'
import NaveResultItem from './NaveResultItem'
import { useAtomValue } from 'jotai/react'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'

const LIMIT = 5
const height = 40
const color1 = 'rgb(80, 83, 140)'
const color2 = 'rgb(48, 51, 107)'

interface LexiqueResultsWidgetProps {
  searchValue: string
}

const LexiqueResultsWidget = ({ searchValue }: LexiqueResultsWidgetProps) => {
  const resources = useResourceAccess()
  const resourceLanguage = useAtomValue(resourcesLanguageAtom).NAVE
  const [limit, setLimit] = useState(LIMIT)

  const { results, error } = useResultsByLetterOrSearch({
    queryKey: ['nave'],
    query: resources.nave.search,
    value: searchValue,
    resourceLanguage,
  })

  if (error) {
    return null
  }

  const naveResults = Array.isArray(results) ? results : []

  if (!naveResults.length) {
    return null
  }

  return (
    <>
      {naveResults.slice(0, limit).map((ref: NaveTopicSummary) => {
        const { normalizedName, name } = ref
        return <NaveResultItem key={normalizedName} name={name} name_lower={normalizedName} />
      })}
      {naveResults.length > limit && (
        <Link onPress={() => setLimit(l => l + 5)}>
          <Box
            opacity={0.5}
            center
            borderRadius={8}
            marginRight={10}
            marginBottom={10}
            height={height}
            paddingHorizontal={20}
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
              <LinearGradient start={[0.1, 0.2]} style={{ height }} colors={[color1, color2]} />
            </Box>
            <Text title fontSize={14} style={{ color: 'white' }}>
              + {naveResults.length - limit}
            </Text>
          </Box>
        </Link>
      )}
    </>
  )
}

export default LexiqueResultsWidget

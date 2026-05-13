import React, { ComponentType, useEffect, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import loadNaveBySearch, { type NaveSearchRow } from '~helpers/loadNaveBySearch'
import { useWaitForDatabase } from '~common/waitForNaveDB'
import { DatabaseError } from '~helpers/catchDatabaseError'

import { useResultsByLetterOrSearch } from '../lexique/useUtilities'
import NaveResultItem from './NaveResultItem'

const hideIfNoDatabase =
  <P extends object>(WrappedComponent: ComponentType<P>) =>
  (props: P) => {
    const { isLoading, proposeDownload } = useWaitForDatabase()

    if (isLoading || proposeDownload) {
      return null
    }
    return <WrappedComponent {...props} />
  }

const LIMIT = 5
const height = 40
const color1 = 'rgb(80, 83, 140)'
const color2 = 'rgb(48, 51, 107)'

interface LexiqueResultsWidgetProps {
  searchValue: string
}

const isDatabaseError = (value: unknown): value is DatabaseError =>
  typeof value === 'object' && value !== null && 'error' in value

const LexiqueResultsWidget = ({ searchValue }: LexiqueResultsWidgetProps) => {
  const [error, setError] = useState<DatabaseError['error'] | null>(null)
  const [limit, setLimit] = useState(LIMIT)

  const { results } = useResultsByLetterOrSearch({
    query: loadNaveBySearch,
    value: searchValue,
  })

  useEffect(() => {
    if (isDatabaseError(results)) {
      setError(results.error)
    }
  }, [results])

  if (error) {
    return null
  }

  const naveResults = Array.isArray(results) ? results : []

  if (!naveResults.length) {
    return null
  }

  return (
    <>
      {naveResults.slice(0, limit).map((ref: NaveSearchRow) => {
        const { name_lower, name } = ref
        return <NaveResultItem key={name_lower} name={name} name_lower={name_lower} />
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

export default hideIfNoDatabase(LexiqueResultsWidget)

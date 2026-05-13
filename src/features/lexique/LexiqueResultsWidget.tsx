import React, { ComponentType, useEffect, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'
import { DatabaseError } from '~helpers/catchDatabaseError'
import { LexiqueRow } from '~helpers/loadLexiqueByLetter'
import { useWaitForDatabase } from '~common/waitForStrongDB'

import { useResultsByLetterOrSearch } from './useUtilities'
import LexiqueResultItem from './LexiqueResultItem'

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

interface LexiqueResultsWidgetProps {
  searchValue: string
}

const isDatabaseError = (value: unknown): value is DatabaseError =>
  typeof value === 'object' && value !== null && 'error' in value

const LexiqueResultsWidget = ({ searchValue }: LexiqueResultsWidgetProps) => {
  const [error, setError] = useState<DatabaseError['error'] | null>(null)
  const [limit, setLimit] = useState(LIMIT)

  const { results } = useResultsByLetterOrSearch({
    query: loadLexiqueBySearch,
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

  const lexiqueResults = Array.isArray(results) ? results : []

  if (!lexiqueResults.length) {
    return null
  }

  return (
    <>
      {lexiqueResults.slice(0, limit).map((strong: LexiqueRow) => {
        const { Mot, Code } = strong
        const variant = 'Grec' in strong ? 'grec' : 'hebreu'
        return <LexiqueResultItem key={Code + Mot} id={Code} title={Mot} variant={variant} />
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

export default hideIfNoDatabase(LexiqueResultsWidget)

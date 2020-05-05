import React, { useState, useEffect } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import loadNaveBySearch from '~helpers/loadNaveBySearch'
import { useWaitForDatabase } from '~common/waitForNaveDB'

import { useResultsByLetterOrSearch } from '../lexique/useUtilities'
import NaveResultItem from './NaveResultItem'

const hideIfNoDatabase = WrappedComponent => props => {
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

const LexiqueResultsWidget = ({ searchValue }) => {
  const [error, setError] = useState(false)
  const [limit, setLimit] = useState(LIMIT)

  const { results, isLoading } = useResultsByLetterOrSearch({
    query: loadNaveBySearch,
    value: searchValue,
  })

  useEffect(() => {
    if (results.error) {
      setError(results.error)
    }
  }, [results])

  if (error) {
    return null
  }

  if (!results.length) {
    return null
  }

  return (
    <>
      {results.slice(0, limit).map(ref => {
        const { name_lower, name } = ref
        return (
          <NaveResultItem
            key={name_lower}
            name={name}
            name_lower={name_lower}
          />
        )
      })}
      {results.length > limit && (
        <Link onPress={() => setLimit(l => l + 5)}>
          <Box
            opacity={0.5}
            center
            rounded
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
              <LinearGradient
                start={[0.1, 0.2]}
                style={{ height }}
                colors={[color1, color2]}
              />
            </Box>
            <Text title fontSize={14} style={{ color: 'white' }}>
              + {results.length - limit}
            </Text>
          </Box>
        </Link>
      )}
    </>
  )
}

export default hideIfNoDatabase(LexiqueResultsWidget)

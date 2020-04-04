import React, { useState, useEffect } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import loadDictionnaireBySearch from '~helpers/loadDictionnaireBySearch'
import { useWaitForDatabase } from '~common/waitForDictionnaireDB'

import { useResultsByLetterOrSearch } from '../lexique/useUtilities'

const hideIfNoDatabase = WrappedComponent => props => {
  const { isLoading, proposeDownload } = useWaitForDatabase()

  if (isLoading || proposeDownload) {
    return null
  }
  return <WrappedComponent {...props} />
}

const LIMIT = 5
const height = 40
const color1 = '#ffd255'
const color2 = '#ffbc00'

const LexiqueResultsWidget = ({ searchValue }) => {
  const [error, setError] = useState(false)
  const [limit, setLimit] = useState(LIMIT)

  const { results, isLoading } = useResultsByLetterOrSearch({
    query: loadDictionnaireBySearch,
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
        const { word } = ref
        return (
          <Link key={word} route="DictionnaryDetail" params={{ word }}>
            <Box
              center
              rounded
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
                  colors={[color1, color2]}
                />
              </Box>
              <Box
                backgroundColor="rgba(0,0,0,0.1)"
                paddingHorizontal={3}
                paddingVertical={2}
                rounded
              >
                <Text fontSize={7} style={{ color: 'white' }}>
                  Mot
                </Text>
              </Box>
              <Text title fontSize={14} style={{ color: 'white' }}>
                {word}
              </Text>
            </Box>
          </Link>
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

import React, { ComponentType, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { DictionnaireSearchRow } from '~features/resources/dictionaryAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useWaitForDatabase } from '~common/waitForDictionnaireDB'

import { useResultsByLetterOrSearch } from '../lexique/useUtilities'
import DictionnaryResultItem from './DictionaryResultItem'
import { useAtomValue } from 'jotai/react'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'

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
const color1 = '#ffd255'
const color2 = '#ffbc00'

interface LexiqueResultsWidgetProps {
  searchValue: string
}

const LexiqueResultsWidget = ({ searchValue }: LexiqueResultsWidgetProps) => {
  const resources = useResourceAccess()
  const resourceLanguage = useAtomValue(resourcesLanguageAtom).DICTIONNAIRE
  const [limit, setLimit] = useState(LIMIT)

  const { results, error } = useResultsByLetterOrSearch({
    queryKey: ['dictionary'],
    query: resources.dictionary.search,
    value: searchValue,
    resourceLanguage,
  })

  if (error) {
    return null
  }

  const dictionaryResults = Array.isArray(results) ? results : []

  if (!dictionaryResults.length) {
    return null
  }

  return (
    <>
      {dictionaryResults.slice(0, limit).map((ref: DictionnaireSearchRow) => {
        const { word } = ref
        return <DictionnaryResultItem key={word} word={word} />
      })}
      {dictionaryResults.length > limit && (
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
              + {dictionaryResults.length - limit}
            </Text>
          </Box>
        </Link>
      )}
    </>
  )
}

export default hideIfNoDatabase(LexiqueResultsWidget)

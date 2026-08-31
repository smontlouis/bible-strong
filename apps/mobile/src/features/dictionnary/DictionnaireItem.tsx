import React from 'react'
import styled from '@emotion/native'
import { Pressable } from 'react-native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

interface DictionnaireItemProps {
  word: string
  sourceLabels?: readonly string[]
  onSelect?: (word: string) => void
}

const SectionItem = styled(Box)(({ theme }) => ({
  height: 60,
  marginLeft: 20,
  marginRight: 20,
  backgroundColor: theme.colors.reverse,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  alignItems: 'flex-start',
  justifyContent: 'center',
}))

const DictionnaireItem = ({ word, sourceLabels, onSelect }: DictionnaireItemProps) => {
  const pushRouteOnce = usePushRouteOnce()

  const handlePress = () => {
    if (onSelect) {
      onSelect(word)
    } else {
      pushRouteOnce({
        pathname: '/dictionnary-detail',
        params: { word },
      })
    }
  }

  const content = (
    <SectionItem>
      <Box>
        <Text title fontSize={18} color="default" flex paddingRight={20}>
          {word}
        </Text>
        {sourceLabels?.length ? (
          <Text fontSize={11} color="tertiary">
            {sourceLabels.join(' · ')}
          </Text>
        ) : null}
      </Box>
    </SectionItem>
  )

  // If onSelect is provided, use Pressable directly instead of Link
  if (onSelect) {
    return (
      <Pressable accessibilityRole="button" onPress={handlePress}>
        {content}
      </Pressable>
    )
  }

  // Otherwise use Link for standard navigation
  return (
    <Link route="DictionnaryDetail" params={{ word }}>
      {content}
    </Link>
  )
}

export default DictionnaireItem

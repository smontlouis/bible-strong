import React, { memo, useCallback } from 'react'
import styled from '@emotion/native'
import { Pressable } from 'react-native'

import { useRouter } from 'expo-router'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

interface DictionnaireItemProps {
  word: string
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

const DictionnaireItem = memo(({ word, onSelect }: DictionnaireItemProps) => {
  const router = useRouter()

  const handlePress = useCallback(() => {
    if (onSelect) {
      onSelect(word)
    } else {
      router.push({
        pathname: '/dictionnary-detail',
        params: { word },
      })
    }
  }, [onSelect, word, router])

  const content = (
    <SectionItem>
      <Box row>
        <Text title fontSize={18} color="default" flex paddingRight={20}>
          {word}
        </Text>
      </Box>
    </SectionItem>
  )

  // If onSelect is provided, use Pressable directly instead of Link
  if (onSelect) {
    return <Pressable onPress={handlePress}>{content}</Pressable>
  }

  // Otherwise use Link for standard navigation
  return (
    <Link route="DictionnaryDetail" params={{ word }}>
      {content}
    </Link>
  )
})

export default DictionnaireItem

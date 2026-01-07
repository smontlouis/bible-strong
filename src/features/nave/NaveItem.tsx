import React, { memo, useCallback } from 'react'
import styled from '@emotion/native'
import { Pressable } from 'react-native'

import { useRouter } from 'expo-router'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

interface NaveItemProps {
  name_lower: string
  name: string
  onSelect?: (name_lower: string, name: string) => void
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

const NaveItem = memo(({ name_lower, name, onSelect }: NaveItemProps) => {
  const router = useRouter()

  const handlePress = useCallback(() => {
    if (onSelect) {
      onSelect(name_lower, name)
    } else {
      router.push({
        pathname: '/nave-detail',
        params: { name_lower, name },
      })
    }
  }, [onSelect, name_lower, name, router])

  const content = (
    <SectionItem>
      <Box row>
        <Text title fontSize={18} color="default" flex paddingRight={20}>
          {name}
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
    <Link route="NaveDetail" params={{ name_lower, name }}>
      {content}
    </Link>
  )
})

export default NaveItem

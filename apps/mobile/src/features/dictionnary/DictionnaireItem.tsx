import React from 'react'
import styled from '@emotion/native'
import { Pressable } from 'react-native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

interface DictionnaireItemProps {
  word: string
  onSelect: () => void
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

const DictionnaireItem = ({ word, onSelect }: DictionnaireItemProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={word}
      onPress={onSelect}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <SectionItem>
        <Box row>
          <Text title fontSize={18} color="default" flex paddingRight={20}>
            {word}
          </Text>
        </Box>
      </SectionItem>
    </Pressable>
  )
}

export default DictionnaireItem

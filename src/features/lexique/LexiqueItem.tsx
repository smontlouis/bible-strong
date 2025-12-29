import React, { memo, useCallback } from 'react'
import styled from '@emotion/native'
import { Pressable } from 'react-native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useTranslation } from 'react-i18next'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

const SectionItem = styled(Box)(({ theme }) => ({
  height: 80,
  marginLeft: 20,
  marginRight: 20,
  backgroundColor: theme.colors.reverse,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  alignItems: 'flex-start',
  justifyContent: 'center',
}))

const Chip = styled(Box)(({ theme, isHebreu }: any) => ({
  borderRadius: 10,
  backgroundColor: isHebreu ? theme.colors.lightPrimary : theme.colors.border,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 5,
  paddingRight: 5,
  marginBottom: 3,
}))

interface LexiqueItemProps {
  Mot: string
  Grec?: string
  Hebreu?: string
  Code: string
  lexiqueType: string
  navigation: StackNavigationProp<MainStackProps>
  onSelect?: (book: number, reference: string) => void
}

const LexiqueItem = memo(
  ({
    Mot,
    Grec,
    Hebreu,
    Code,
    lexiqueType,
    navigation,
    onSelect,
  }: LexiqueItemProps) => {
    const { t } = useTranslation()
    const book = lexiqueType === 'Hébreu' ? 1 : 40

    const handlePress = useCallback(() => {
      if (onSelect) {
        onSelect(book, Code)
      } else {
        navigation.navigate('Strong', { book, reference: Code })
      }
    }, [onSelect, book, Code, navigation])

    const content = (
      <SectionItem>
        <Box row>
          <Chip isHebreu={lexiqueType === 'Hébreu'}>
            <Text fontSize={10}>{t(lexiqueType)}</Text>
          </Chip>
          <Chip marginLeft={5}>
            <Text fontSize={10}>{Code}</Text>
          </Chip>
        </Box>
        <Box row>
          <Text title fontSize={18} color="default" flex paddingRight={20}>
            {Mot}
          </Text>
          <Text fontSize={18} color="default">
            {Grec || Hebreu}
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
      <Link route="Strong" navigation={navigation} params={{ book, reference: Code }}>
        {content}
      </Link>
    )
  }
)

export default LexiqueItem

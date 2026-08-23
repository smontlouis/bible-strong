import { ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@emotion/react'
import { Image } from 'expo-image'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { hp } from '~helpers/utils'

type Props = {
  onExamplePress: (value: string) => void
}

const ExampleChip = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <Box px={12} py={4} borderRadius={20} bg="lightGrey" borderWidth={1} borderColor="border">
      <Text fontSize={14} color="default">
        {label}
      </Text>
    </Box>
  </TouchableOpacity>
)

const SearchEmptyState = ({ onExamplePress }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const examples = [
    t('search.empty.verses.examples').split('|')[0],
    t('search.empty.verse_words.examples').split('|')[0],
    'H1234',
    'G26',
    t('search.empty.words.examples').split('|')[0],
  ]

  return (
    <Box h={hp(60)} justifyContent="center" alignItems="center">
      <Box alignItems="center" mt={30} mb={24}>
        <Box mb={16}>
          <Image
            source={require('~assets/images/empty-state-icons/search.svg')}
            style={{ width: 80, height: 80, opacity: 0.6 }}
            tintColor={theme.colors.tertiary}
            contentFit="contain"
          />
        </Box>
        <Text textAlign="center" color="tertiary" fontSize={16}>
          {t('search.empty.title')}
        </Text>
      </Box>

      <HStack maxWidth={320} alignSelf="center" justifyContent="center" gap={8} wrap>
        {examples.map(example => (
          <ExampleChip key={example} label={example} onPress={() => onExamplePress(example)} />
        ))}
      </HStack>
    </Box>
  )
}

export default SearchEmptyState

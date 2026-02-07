import { ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@emotion/react'
import { Image } from 'expo-image'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'

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

type SectionProps = {
  title: string
  examples: string[]
  onExamplePress: (value: string) => void
}

const Section = ({ title, examples, onExamplePress }: SectionProps) => (
  <Box mb={20}>
    <Text fontSize={13} color="tertiary" bold mb={8}>
      {title}
    </Text>
    <HStack gap={8} wrap>
      {examples.map(example => (
        <ExampleChip key={example} label={example} onPress={() => onExamplePress(example)} />
      ))}
    </HStack>
  </Box>
)

const SearchEmptyState = ({ onExamplePress }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <ScrollView
      contentContainerStyle={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Box alignItems="center" mb={24}>
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

      <Box w="100%">
        <Section
          title={t('search.empty.verses')}
          examples={t('search.empty.verses.examples').split('|')}
          onExamplePress={onExamplePress}
        />
        <Section
          title={t('search.empty.verse_words')}
          examples={t('search.empty.verse_words.examples').split('|')}
          onExamplePress={onExamplePress}
        />
        <Section
          title={t('search.empty.strong')}
          examples={['H1234', 'G26']}
          onExamplePress={onExamplePress}
        />
        <Section
          title={t('search.empty.words')}
          examples={t('search.empty.words.examples').split('|')}
          onExamplePress={onExamplePress}
        />
      </Box>
    </ScrollView>
  )
}

export default SearchEmptyState

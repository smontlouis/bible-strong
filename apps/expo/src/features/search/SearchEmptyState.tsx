import { ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { Image } from 'expo-image'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { hp } from '~helpers/utils'
type Props = {
  isOnline: boolean
  onExamplePress: (value: string) => void
}

const ExampleChip = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.7}>
    <Box className="border-continuous overflow-hidden px-[12px] py-[4px] rounded-[20px] bg-light-grey border-[1px] border-border">
      <Text className="text-[14px] text-default">{label}</Text>
    </Box>
  </TouchableOpacity>
)

const SearchEmptyState = ({ isOnline, onExamplePress }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const examples = [
    t('search.empty.verses.examples').split('|')[0],
    `"${t('search.empty.verse_words.examples').split('|')[0]}"`,
    t('search.empty.words.examples').split('|')[0],
    'G26',
    'H430',
    ...(isOnline
      ? ['ἀγάπη', 'אֱלֹהִים', 'agapē', ...t('search.empty.semantic.examples').split('|')]
      : []),
  ]

  return (
    <Box
      className="overflow-hidden border-continuous justify-center items-center"
      style={{ height: hp(60) }}
    >
      <Box className="overflow-hidden border-continuous items-center mt-[30px] mb-[24px]">
        <Box className="overflow-hidden border-continuous mb-[16px]">
          <Image
            source={require('~assets/images/empty-state-icons/search.svg')}
            style={{ width: 80, height: 80, opacity: 0.6 }}
            tintColor={theme.colors.tertiary}
            contentFit="contain"
          />
        </Box>
        <Text className="text-center text-tertiary text-[16px]">{t('search.empty.title')}</Text>
      </Box>

      <HStack className="overflow-hidden border-continuous max-w-[320px] self-center justify-center gap-[8px] flex-wrap">
        {examples.map(example => (
          <ExampleChip key={example} label={example} onPress={() => onExamplePress(example)} />
        ))}
      </HStack>
    </Box>
  )
}

export default SearchEmptyState

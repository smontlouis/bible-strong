import { Platform } from 'react-native'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { readingHtmlEngineAtom } from '~state/readingHtmlEngine'
import Box, { TouchableBox } from './ui/Box'
import Text from './ui/Text'

export default function ReadingHtmlEngineSetting() {
  const { t } = useTranslation()
  const [engine, setEngine] = useAtom(readingHtmlEngineAtom)
  if (Platform.OS === 'web') return null
  return (
    <Box className="px-[20px] py-[12px] gap-[8px]">
      <Text>{t('readingHtml.engineTitle')}</Text>
      <Text className="text-[12px] text-grey">{t('readingHtml.engineDescription')}</Text>
      <Box className="flex-row gap-[10px]">
        {(['native', 'dom'] as const).map(value => (
          <TouchableBox
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: engine === value }}
            onPress={() => setEngine(value)}
            className={
              engine === value
                ? 'bg-light-primary px-[14px] py-[10px] rounded-[10px]'
                : 'bg-light-grey px-[14px] py-[10px] rounded-[10px]'
            }
          >
            <Text>{t(value === 'native' ? 'readingHtml.native' : 'readingHtml.dom')}</Text>
          </TouchableBox>
        ))}
      </Box>
    </Box>
  )
}

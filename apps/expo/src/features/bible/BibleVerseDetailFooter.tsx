import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const IconButton = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('items-center justify-center flex-row', className)
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, {}, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

const FeatherIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('text-default', className))
  return (
    <Icon.Feather
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

type BibleVerseDetailFooterProps = {
  verseNumber: number | string
  goToNextVerse: (versesInCurrentChapter: number) => void
  goToPrevVerse: (versesInCurrentChapter: number) => void
  versesInCurrentChapter?: number | null
}

const BibleVerseDetailFooter = ({
  verseNumber,
  goToNextVerse,
  goToPrevVerse,
  versesInCurrentChapter,
}: BibleVerseDetailFooterProps) => {
  const { t } = useTranslation()
  if (!versesInCurrentChapter) return null

  const currentVerseNumber = Number(verseNumber)

  return (
    <Box className="overflow-hidden border-continuous flex-row pl-[20px] pr-[20px] mb-[20px]">
      {currentVerseNumber !== 1 && (
        <IconButton activeOpacity={0.5} onPress={() => goToPrevVerse(versesInCurrentChapter)}>
          <FeatherIcon name="arrow-left-circle" size={16} />
          <Text className="text-[12px] pl-[10px] text-dark-grey">{t('Verset précédent')}</Text>
        </IconButton>
      )}
      <Box className="overflow-hidden border-continuous flex-[1]" />
      {currentVerseNumber !== versesInCurrentChapter && (
        <IconButton activeOpacity={0.5} onPress={() => goToNextVerse(versesInCurrentChapter)}>
          <Text className="text-[12px] pr-[10px] text-dark-grey">{t('Verset suivant')}</Text>
          <FeatherIcon name="arrow-right-circle" size={16} />
        </IconButton>
      )}
    </Box>
  )
}

export default BibleVerseDetailFooter

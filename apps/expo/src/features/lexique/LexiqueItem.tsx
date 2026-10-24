import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import { Pressable } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import { useTranslation } from 'react-i18next'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { createStrongIdentityForBook } from '~helpers/strongIdentities'
import { createStrongDetailRoute } from './strongDetailRoutes'

/** Height of a row, used by the list layout. */
export const LEXIQUE_ITEM_HEIGHT = 80

const chipClassName = 'rounded-full px-[6px] py-[2px]'

interface LexiqueItemProps extends StrongLexiconSearchResult {
  onSelect?: (book: number, reference: string, title?: string) => void
  /** The hairline under the row; the last row of a group has none. */
  hasSeparator?: boolean
}

const LexiqueItem = ({
  stepCode,
  language,
  original,
  gloss,
  onSelect,
  hasSeparator = true,
}: LexiqueItemProps) => {
  const stylingTheme = useStylingTheme()
  const pushRouteOnce = usePushRouteOnce()

  const { t } = useTranslation()
  const book = language === 'hebrew' ? 1 : 40
  const lexiqueType = language === 'hebrew' ? 'Hébreu' : 'Grec'

  const handlePress = () => {
    if (onSelect) {
      onSelect(book, stepCode, gloss)
      return
    }
    const identity = createStrongIdentityForBook(stepCode, book)
    pushRouteOnce(
      createStrongDetailRoute('index', {
        book,
        reference: identity.code,
        identityKind: identity.kind,
        identityCode: identity.code,
      })
    )
  }

  return (
    <Pressable
      accessibilityRole={onSelect ? 'button' : 'link'}
      onPress={handlePress}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Box className="px-[20px] items-start justify-center" style={{ height: LEXIQUE_ITEM_HEIGHT }}>
        <Box className="flex-row gap-[5px] mb-[3px]">
          <Box
            className={twMerge(
              chipClassName,
              language === 'hebrew' ? 'bg-light-primary' : 'bg-border'
            )}
          >
            <Text className="text-[10px]">{t(lexiqueType)}</Text>
          </Box>
          <Box className={twMerge(chipClassName, 'bg-border')}>
            <Text className="text-[10px]">{stepCode}</Text>
          </Box>
        </Box>
        <Box className="flex-row">
          <Text
            className="text-[18px] text-default flex-[1] pr-[20px]"
            style={titleFontStyle(stylingTheme)}
          >
            {gloss}
          </Text>
          <Text
            className="text-[18px] text-default"
            accessibilityLanguage={language === 'hebrew' ? 'he-IL' : 'el-GR'}
          >
            {original}
          </Text>
        </Box>
        {hasSeparator && <Border className="absolute bottom-0 left-[20px] right-0" />}
      </Box>
    </Pressable>
  )
}

export default LexiqueItem

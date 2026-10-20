import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LinkBox } from '~common/Link'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { useTheme } from '~themes/ThemeProvider'
import AnimatedVerseHeight from './AnimatedVerseHeight.web'
import OfflineNotice from './OfflineNotice'
import UserWidget from './UserWidget'
import VerseOfTheDay from './VerseOfTheDay'
import { VISIBLE_VERSE_OF_THE_DAY_OFFSETS } from './verseOfTheDayPolicy'

/**
 * The same five days as the carousel, chosen with previous/next buttons and selectable dots.
 * The full text is shown and the card height follows it.
 */
function DailyVerse() {
  const { t } = useTranslation()
  const theme = useTheme()
  const [index, setIndex] = useState(VISIBLE_VERSE_OF_THE_DAY_OFFSETS.length - 1)
  const lastIndex = VISIBLE_VERSE_OF_THE_DAY_OFFSETS.length - 1
  const navigation = (
    <HStack className="items-center gap-[6px]">
      <LinkBox
        accessibilityLabel={t('home.desktop.previousVerse')}
        disabled={index === 0}
        accessibilityState={{ disabled: index === 0 }}
        onPress={() => setIndex(i => Math.max(0, i - 1))}
        className="items-center justify-center w-[32px] h-[32px] rounded-full"
        style={{ opacity: index === 0 ? 0.25 : 1 }}
      >
        <FeatherIcon name="chevron-left" size={18} color="grey" />
      </LinkBox>
      {VISIBLE_VERSE_OF_THE_DAY_OFFSETS.map((offset, i) => (
        <LinkBox
          key={offset}
          accessibilityLabel={
            offset === 0 ? t("Aujourd'hui") : t('home.desktop.daysAgo', { count: -offset })
          }
          accessibilityState={{ selected: index === i }}
          onPress={() => setIndex(i)}
          className="items-center justify-center w-[24px] h-[32px]"
        >
          <Box
            className="h-[6px] rounded-full"
            style={{
              width: index === i ? 16 : 6,
              backgroundColor: index === i ? theme.colors.primary : theme.colors.border,
            }}
          />
        </LinkBox>
      ))}
      <LinkBox
        accessibilityLabel={t('home.desktop.nextVerse')}
        disabled={index === lastIndex}
        accessibilityState={{ disabled: index === lastIndex }}
        onPress={() => setIndex(i => Math.min(lastIndex, i + 1))}
        className="items-center justify-center w-[32px] h-[32px] rounded-full"
        style={{ opacity: index === lastIndex ? 0.25 : 1 }}
      >
        <FeatherIcon name="chevron-right" size={18} color="grey" />
      </LinkBox>
    </HStack>
  )

  return (
    <AnimatedVerseHeight>
      <HStack className="rounded-[30px] bg-reverse overflow-hidden">
        <VerseOfTheDay
          addDay={VISIBLE_VERSE_OF_THE_DAY_OFFSETS[index]}
          desktop
          navigation={navigation}
          style={{ minWidth: 0 }}
        />
      </HStack>
    </AnimatedVerseHeight>
  )
}

/**
 * « Aujourd’hui ». A mouse cannot swipe the carousel, so the wide Web home pages through the
 * same days with buttons; a phone-sized browser keeps the carousel.
 */
export default function HomeToday() {
  const isWide = useResponsiveWorkspace()
  if (!isWide) return <UserWidget />
  return (
    <Box>
      <OfflineNotice />
      <Box className="px-[20px]">
        <DailyVerse />
      </Box>
    </Box>
  )
}

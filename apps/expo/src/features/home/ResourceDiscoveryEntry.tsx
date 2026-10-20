import { createContext, useContext, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Link, { type LinkProps } from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import type { MainStackProps } from '~navigation/type'

/** Set by the home around each card: the resource icon shown before the category. */
export const DiscoveryCardContext = createContext<{ icon: ReactNode } | null>(null)

/**
 * Fixed card: a header row with the resource icon, the category and the shuffle button, above
 * the word on one line and its gloss. Shuffle is a sibling of the entry link, so it never opens
 * the reader; only the entry remounts when the word changes, which fades it in on Web.
 */
export default function ResourceDiscoveryEntry({
  title,
  category,
  original,
  detail,
  onShuffle,
  isRefreshing,
}: {
  title: string
  category: string
  original?: string
  detail: LinkProps<keyof MainStackProps>
  onShuffle: () => void
  isRefreshing?: boolean
}) {
  const { t } = useTranslation()
  const card = useContext(DiscoveryCardContext)

  return (
    <Box className="flex-1 min-w-0 gap-[10px]">
      <Box className="flex-row items-center justify-between gap-[8px]">
        <Box className="flex-1 min-w-0 flex-row items-center gap-[8px]">
          {card?.icon}
          <Text className="shrink text-[13px] text-tertiary" numberOfLines={1}>
            {category}
          </Text>
        </Box>
        <Link
          onPress={onShuffle}
          disabled={isRefreshing}
          accessibilityState={{ busy: isRefreshing, disabled: isRefreshing }}
          accessibilityLabel={t('home.discovery.shuffle')}
          className="items-center justify-center shrink-0 h-[36px] w-[36px] rounded-full bg-canvas"
        >
          <FeatherIcon name="shuffle" size={17} color="grey" />
        </Link>
      </Box>
      <Link
        {...detail}
        className="min-w-0"
        accessibilityLabel={t('home.discovery.readEntry', { word: title })}
      >
        <Box
          key={JSON.stringify([original, title])}
          className="bs-home-discovery-fade min-w-0 items-start gap-[2px]"
        >
          {original ? (
            <Text
              className="text-[24px] leading-[30px]"
              style={{ fontFamily: 'Literata Book' }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {original}
            </Text>
          ) : null}
          <Text className="text-[15px] leading-[20px] font-bold" numberOfLines={1}>
            {title}
          </Text>
        </Box>
      </Link>
    </Box>
  )
}

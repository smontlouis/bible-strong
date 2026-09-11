import { useTranslation } from 'react-i18next'
import Link, { type LinkProps } from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import type { MainStackProps } from '~navigation/type'

/** Shuffle is a sibling of the entry link, so it never opens the reader. */
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
  return (
    <Box className="flex-1 min-w-0 flex-row items-center gap-[14px]">
      <Box className="flex-1 min-w-0 gap-[4px]">
        <Text className="text-[13px] text-tertiary" numberOfLines={1}>
          {category}
        </Text>
        <Link
          {...detail}
          className="min-w-0"
          accessibilityLabel={t('home.discovery.readEntry', { word: title })}
        >
          <Box
            key={JSON.stringify([original, title])}
            className="bs-home-discovery-fade min-w-0 items-start gap-[4px]"
          >
            {original ? (
              <Text
                className="text-[24px] leading-[28px]"
                style={{ fontFamily: 'Literata Book' }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {original}
              </Text>
            ) : null}
            <Text className="text-[18px] leading-[23px] font-bold" numberOfLines={2}>
              {title}
            </Text>
          </Box>
        </Link>
      </Box>
      <Link
        onPress={onShuffle}
        disabled={isRefreshing}
        accessibilityState={{ busy: isRefreshing, disabled: isRefreshing }}
        accessibilityLabel={t('home.discovery.shuffle')}
        className="items-center justify-center shrink-0 h-[36px] w-[36px] rounded-[10px] bg-light-grey"
      >
        <FeatherIcon name="shuffle" size={17} color="grey" />
      </Link>
    </Box>
  )
}

import { useTranslation } from 'react-i18next'
import Link, { type LinkProps } from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import type { MainStackProps } from '~navigation/type'
import ResourceIcon from '~common/icons/ResourceIcon'

/** Shuffle is a sibling of the entry link, so it never opens the reader. */
export default function ResourceDiscoveryEntry({
  title,
  original,
  iconKind,
  detail,
  onShuffle,
  isRefreshing,
}: {
  title: string
  original?: string
  iconKind?: 'nave' | 'dictionary'
  detail: LinkProps<keyof MainStackProps>
  onShuffle: () => void
  isRefreshing?: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <Link
        onPress={onShuffle}
        disabled={isRefreshing}
        accessibilityState={{ busy: isRefreshing, disabled: isRefreshing }}
        accessibilityLabel={t('home.discovery.shuffle')}
        className="bs-home-discovery-shuffle items-center justify-center h-[36px] w-[36px] rounded-[10px]"
      >
        <FeatherIcon name="shuffle" size={17} color="grey" />
      </Link>
      <Link
        {...detail}
        className="bs-home-discovery-content items-center justify-center w-full px-[8px] pt-0 pb-[12px] gap-[4px]"
        accessibilityLabel={t('home.discovery.readEntry', { word: title })}
      >
        <Box
          key={JSON.stringify([original, title])}
          className="bs-home-discovery-fade w-full items-center justify-center gap-[4px]"
        >
          {original ? (
            <Text
              className="text-[32px] leading-[36px] text-center"
              style={{ fontFamily: 'Literata Book' }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {original}
            </Text>
          ) : (
            iconKind && <ResourceIcon kind={iconKind} size={36} />
          )}
          <Text className="text-[20px] leading-[24px] font-bold text-center" numberOfLines={2}>
            {title}
          </Text>
        </Box>
      </Link>
    </>
  )
}

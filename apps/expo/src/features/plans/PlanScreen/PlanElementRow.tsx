import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import type { EntitySlice } from '~common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import { readingMinutes, type ElementSize } from '../planReadingTime'

/**
 * An element of a day: its checkbox once the plan is followed, its name over its first line in
 * the reading font (or its kind, for a video or an image), and the time it takes.
 */
const PlanElementRow = ({
  slice,
  title,
  size,
  started,
  read,
  onToggle,
  onOpen,
}: {
  slice: EntitySlice
  title: string
  size?: ElementSize
  started: boolean
  read: boolean
  onToggle: () => void
  onOpen: () => void
}) => {
  const { t } = useTranslation()
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  const kind =
    slice.type === 'Video'
      ? t('readingPlans.video')
      : slice.type === 'Image'
        ? t('readingPlans.image')
        : undefined
  const minutes = size?.words
    ? t('readingPlans.minutes', { count: readingMinutes(size.words) })
    : undefined
  const meta = [
    size?.verses ? t('readingPlans.verses', { count: size.verses }) : undefined,
    minutes,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Box className="min-h-[68px] flex-row items-center gap-[14px]">
      {started && (
        <Link
          size={36}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: read }}
          accessibilityLabel={title}
          onPress={onToggle}
        >
          <FeatherIcon
            name={read ? 'check-circle' : 'circle'}
            size={24}
            color={read ? 'success' : 'grey'}
          />
        </Link>
      )}
      <Link
        accessibilityRole="link"
        accessibilityLabel={[title, meta].filter(Boolean).join(', ')}
        className="flex-1 flex-row items-center gap-[12px] py-[12px]"
        onPress={onOpen}
      >
        <Box className="flex-1 gap-[3px]">
          <Box className="flex-row items-baseline gap-[8px]">
            <Text className="flex-1 text-default text-[16px] font-bold" numberOfLines={2}>
              {title}
            </Text>
            {!!minutes && (
              <Text className="text-grey text-[12px]" style={{ fontVariant: ['tabular-nums'] }}>
                {minutes}
              </Text>
            )}
          </Box>
          {size?.opening ? (
            <Text className="text-grey text-[14px]" style={{ fontFamily }} numberOfLines={1}>
              {size.opening}
            </Text>
          ) : kind ? (
            <Text className="text-grey text-[13px]">{kind}</Text>
          ) : null}
        </Box>
        <FeatherIcon name="chevron-right" size={20} color="grey" />
      </Link>
    </Box>
  )
}

export default PlanElementRow

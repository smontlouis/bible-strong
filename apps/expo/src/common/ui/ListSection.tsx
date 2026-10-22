import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import Link, { type LinkProps } from '~common/Link'
import { twMerge } from '~common/ui/classNames'
import { MainStackProps } from '~navigation/type'
import Box from './Box'
import Card from './Card'
import { FeatherIcon } from './Icon'
import IconTile, { ICON_TILE_SIZE } from './IconTile'
import NotificationDot from './NotificationDot'
import Text from './Text'

const ROW_PADDING = 14
const ROW_GAP = 12
const ICON_INSET = ROW_PADDING + ICON_TILE_SIZE + ROW_GAP

/** The title of a group, set on the canvas above its card. */
export const ListSectionTitle = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <Text
    accessibilityRole="header"
    className={twMerge('text-[13px] text-grey mb-[9px] ml-[4px]', className)}
  >
    {children}
  </Text>
)

/** A hairline between two rows, starting where the row's text starts. */
export const ListSeparator = ({
  inset = ROW_PADDING,
  overlay = false,
}: {
  inset?: number
  /** Laid over the bottom edge of the row that holds it: the row keeps its height. */
  overlay?: boolean
}) => (
  <Box
    className="bg-separator"
    style={
      overlay
        ? {
            position: 'absolute',
            left: inset,
            right: 0,
            bottom: 0,
            height: StyleSheet.hairlineWidth,
          }
        : { height: StyleSheet.hairlineWidth, marginLeft: inset }
    }
  />
)

type ListSectionProps = {
  title?: string
  /** A note under the card, for what the rows do not say. */
  footer?: string
  children: ReactNode
  className?: string
  /** Where the hairline under a row that is not a `ListRow` starts: where its text starts. */
  separatorInset?: number
}

/**
 * A group of rows on the canvas: its title on the page, its rows in one card, split by hairlines.
 * Rows may be `ListRow`s or any content; separators follow the text of the row above.
 */
const ListSection = ({
  title,
  footer,
  children,
  className,
  separatorInset: contentInset = ROW_PADDING,
}: ListSectionProps) => {
  const rows = Children.toArray(children)
  return (
    <Box className={twMerge('mx-[20px] mb-[22px]', className)}>
      {title ? <ListSectionTitle>{title}</ListSectionTitle> : null}
      <Card>
        {rows.map((row, index) => (
          <Fragment key={isValidElement(row) && row.key != null ? row.key : index}>
            {index > 0 && <ListSeparator inset={separatorInset(rows[index - 1], contentInset)} />}
            {row}
          </Fragment>
        ))}
      </Card>
      {footer ? <Text className="text-[13px] text-grey mt-[8px] mx-[4px]">{footer}</Text> : null}
    </Box>
  )
}

const separatorInset = (row: ReturnType<typeof Children.toArray>[number], contentInset: number) =>
  isValidElement<ListRowProps>(row) && row.type === ListRow
    ? row.props.icon
      ? ICON_INSET
      : ROW_PADDING
    : contentInset

type ListRowProps = Pick<
  LinkProps<keyof MainStackProps>,
  | 'route'
  | 'params'
  | 'href'
  | 'share'
  | 'onPress'
  | 'disabled'
  | 'accessibilityLabel'
  | 'accessibilityHint'
  | 'accessibilityState'
> & {
  label: string
  description?: string
  icon?: ReactNode
  /** Palette token or color whose 12% tint fills the icon tile. */
  iconTint?: string
  /** Exact fill of the icon tile. */
  iconBg?: string
  /** Shown at the end of the row instead of the chevron. */
  trailing?: ReactNode
  hasChevron?: boolean
  destructive?: boolean
  badge?: boolean
  labelClassName?: string
}

/** One row of a `ListSection`: an icon tile, a label, an optional description, a chevron. */
export const ListRow = ({
  label,
  description,
  icon,
  iconTint,
  iconBg,
  trailing,
  hasChevron = true,
  destructive = false,
  badge = false,
  labelClassName,
  ...linkProps
}: ListRowProps) => (
  <Link
    {...linkProps}
    className="flex-row items-center"
    style={{ gap: ROW_GAP, paddingHorizontal: ROW_PADDING, paddingVertical: description ? 10 : 11 }}
  >
    {icon ? (
      <Box>
        <IconTile tint={iconTint} bg={iconBg}>
          {icon}
        </IconTile>
        {badge && (
          <NotificationDot size={10} style={{ position: 'absolute', top: -3, right: -3 }} />
        )}
      </Box>
    ) : null}
    <Box className="flex-[1]">
      <Text
        className={twMerge('text-[15px]', destructive && 'text-quart', labelClassName)}
        numberOfLines={2}
      >
        {label}
      </Text>
      {description ? (
        <Text className="text-[13px] text-grey mt-[2px]" numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </Box>
    {trailing ?? (hasChevron ? <FeatherIcon name="chevron-right" size={18} color="grey" /> : null)}
  </Link>
)

export default ListSection

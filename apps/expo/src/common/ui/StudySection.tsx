import React from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { TouchableBox, VStack } from './Box'
import Card from './Card'
import { FeatherIcon } from './Icon'
import { ListSectionTitle, ListSeparator } from './ListSection'
import PageContent from './PageContent'
import Text from './Text'

/** Where the text of a study page's cards starts: their inner margin and the start of their hairlines. */
export const STUDY_CARD_INSET = 16

/** The width of a study page's column on a wide screen. */
export const STUDY_COLUMN_MAX_WIDTH = 600

/** Rows in one card, split by hairlines that start where their text starts. */
export const StudyRowsCard = ({ children }: { children: React.ReactNode }) => {
  const rows = React.Children.toArray(children)
  return (
    <Card>
      {rows.map((row, index) => (
        <React.Fragment key={React.isValidElement(row) && row.key != null ? row.key : index}>
          {index > 0 && <ListSeparator inset={STUDY_CARD_INSET} />}
          {row}
        </React.Fragment>
      ))}
    </Card>
  )
}

/** Text set inside a card, at its inner margin. */
export const StudyCardBody = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => <VStack className={twMerge('p-[16px] gap-[12px]', className)}>{children}</VStack>

/** The last row of a card, which opens the page that shows all of it. */
export const StudyMoreRow = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableBox
    className="flex-row items-center gap-[12px] px-[16px] py-[12px]"
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text className="flex-[1] text-primary text-[15px]">{label}</Text>
    <FeatherIcon name="chevron-right" color="grey" size={18} />
  </TouchableBox>
)

/**
 * A section of a study page (design system, « The app »): its title on the canvas, its content in
 * a card. `body` sets the content at the card's margin, `rows` splits rows by hairlines, `none`
 * leaves the content on the canvas. With `onToggle`, the card opens on a row that names the content.
 */
export const StudySection = ({
  title,
  children,
  onLayout,
  subtitle,
  expanded,
  onToggle,
  surface = 'body',
  className,
}: {
  title: string
  children: React.ReactNode
  onLayout?: (event: LayoutChangeEvent) => void
  /** The row of a section that opens: what it holds, such as the reference of a verse. */
  subtitle?: string
  expanded?: boolean
  onToggle?: () => void
  surface?: 'body' | 'rows' | 'none'
  className?: string
}) => (
  <PageContent
    className={twMerge('mt-[26px]', className)}
    style={{ maxWidth: STUDY_COLUMN_MAX_WIDTH }}
    onLayout={onLayout}
  >
    <ListSectionTitle>{title}</ListSectionTitle>
    {onToggle ? (
      <Card>
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: Boolean(expanded) }}
          onPress={onToggle}
          activeOpacity={0.7}
          className="flex-row items-center gap-[12px] px-[16px] py-[12px]"
        >
          <Text className="flex-[1] text-[15px]" numberOfLines={1}>
            {subtitle || title}
          </Text>
          <FeatherIcon name={expanded ? 'chevron-up' : 'chevron-down'} color="grey" size={18} />
        </TouchableBox>
        {expanded && (
          <>
            <ListSeparator inset={STUDY_CARD_INSET} />
            <StudyCardBody>{children}</StudyCardBody>
          </>
        )}
      </Card>
    ) : surface === 'rows' ? (
      <StudyRowsCard>{children}</StudyRowsCard>
    ) : surface === 'body' ? (
      <Card>
        <StudyCardBody>{children}</StudyCardBody>
      </Card>
    ) : (
      <VStack className="gap-[12px]">{children}</VStack>
    )}
  </PageContent>
)

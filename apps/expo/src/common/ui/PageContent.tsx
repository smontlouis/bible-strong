import { twMerge } from '~common/ui/classNames'
import type { ViewProps, ViewStyle } from 'react-native'
import Box, { type BoxProps } from './Box'

/** Shared reading width, including each screen's own horizontal padding. */
export const PAGE_CONTENT_MAX_WIDTH = 830

export const pageContentStyle = {
  width: '100%',
  maxWidth: PAGE_CONTENT_MAX_WIDTH,
  alignSelf: 'center',
} satisfies ViewStyle

/** Place inside full-width surfaces so their backgrounds and dividers can span the screen. */
const PageContent = (props: BoxProps & ViewProps) => (
  <Box
    {...props}
    style={[{ maxWidth: PAGE_CONTENT_MAX_WIDTH }, props.style]}
    className={twMerge(
      'overflow-hidden border-continuous',
      twMerge('overflow-hidden border-continuous w-[100%] self-center', props.className)
    )}
  />
)

export default PageContent

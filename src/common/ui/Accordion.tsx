import React from 'react'
import Box, { TouchableBox } from './Box'
import { FeatherIcon } from './Icon'

type Props = {
  title: React.ReactNode
  children: React.ReactNode
  defaultExpanded?: boolean
  accessibilityLabel?: string
}
const Accordion = ({ title, children, defaultExpanded = false, accessibilityLabel }: Props) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  return (
    <Box py={20}>
      <TouchableBox
        accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        row
        onPress={() => setExpanded(s => !s)}
        alignItems="center"
      >
        <Box flex>{title}</Box>
        <FeatherIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={24} />
      </TouchableBox>
      {expanded && <Box py={20}>{children}</Box>}
    </Box>
  )
}

export default Accordion

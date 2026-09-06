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
    <Box className="overflow-hidden border-continuous py-[20px]">
      <TouchableBox
        className="overflow-hidden border-continuous items-center flex-row"
        accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(s => !s)}
      >
        <Box className="overflow-hidden border-continuous flex-[1]">{title}</Box>
        <FeatherIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={24} />
      </TouchableBox>
      {expanded && <Box className="overflow-hidden border-continuous py-[20px]">{children}</Box>}
    </Box>
  )
}

export default Accordion

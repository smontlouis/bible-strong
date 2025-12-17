import React from 'react'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { TextSlice as TextSliceProps } from '~common/types'
import { FeatherIcon } from '~common/ui/Icon'

const TextSlice = ({ description, subType }: TextSliceProps) => {
  const isDevotional = subType === 'devotional'
  const content = isDevotional
    ? description.replace(/^\n|\n$/g, '')
    : description.replace(/^\n/, '')
  return (
    <Box
      paddingHorizontal={20}
      {...(isDevotional && {
        center: true,
        backgroundColor: 'lightGrey',
        paddingVertical: 20,
        marginBottom: 40,
      })}
    >
      {isDevotional && (
        <FeatherIcon color="primary" name="minus" style={{ marginBottom: 20 }} size={30} />
      )}
      <Paragraph
        scaleLineHeight={1}
        color={isDevotional ? 'primary' : 'default'}
        textAlign={isDevotional ? 'center' : 'left'}
      >
        {content}
      </Paragraph>
      {isDevotional && (
        <FeatherIcon color="primary" name="minus" style={{ marginTop: 20 }} size={30} />
      )}
    </Box>
  )
}

export default TextSlice

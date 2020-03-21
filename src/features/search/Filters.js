import React from 'react'
import { ScrollView } from 'react-native'
import RefinementList from './RefinementList'

import Box from '~common/ui/Box'
import { MAX_WIDTH } from '~helpers/useDimensions'

const Filters = ({}) => (
  <Box maxWidth={MAX_WIDTH} width="100%" marginLeft="auto" marginRight="auto">
    <ScrollView
      horizontal
      style={{ maxHeight: 55, paddingHorizontal: 10 }}
      contentContainerStyle={{
        flexDirection: 'row'
      }}
    >
      <RefinementList attribute="section" />
      <RefinementList attribute="book" limit={100} />
    </ScrollView>
  </Box>
)

export default Filters

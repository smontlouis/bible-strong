import React from 'react'
import { ScrollView } from 'react-native'
import RefinementList from './RefinementList'

const Filters = ({}) => (
  <ScrollView
    horizontal
    style={{ maxHeight: 55, paddingHorizontal: 10 }}
    contentContainerStyle={{
      flexDirection: 'row'
    }}>
    <RefinementList attribute="section" />
    <RefinementList attribute="book" limit={100} />
  </ScrollView>
)

export default Filters

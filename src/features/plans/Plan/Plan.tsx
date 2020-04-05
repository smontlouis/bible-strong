import React from 'react'
import ScrollView from '~common/ui/ScrollView'
import { MyPlan } from '~common/types'

import Section from '../Section/Section'

const Plan = ({ sections }: MyPlan) => {
  return (
    <ScrollView>
      {sections.map(section => (
        <Section
          key={section.id}
          id={section.id}
          title={section.title}
          subTitle={section.subTitle}
          readingSlices={section.readingSlices}
        />
      ))}
    </ScrollView>
  )
}

export default Plan

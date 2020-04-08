import React from 'react'
import { SectionList } from 'react-native'
import { Plan as PlanProps } from '~common/types'

import ReadingSlice from '../ReadingSlice/ReadingSlice'
import Section from '../Section/Section'
import { useTransformSections } from '../plan.hooks'

const Plan = ({ sections }: PlanProps) => {
  const [expandedSectionIds, setExpandedSectionIds] = React.useState<string[]>(
    []
  )
  const updatedSections = useTransformSections(sections)
  const toggle = (id: string) => {
    setExpandedSectionIds(s =>
      s.includes(id) ? s.filter(i => i !== id) : [...s, id]
    )
  }

  if (!updatedSections.length) {
    return null
  }

  return (
    <SectionList
      sections={updatedSections.map(s => ({
        ...s,
        data: expandedSectionIds.includes(s.id) ? s.data : [],
      }))}
      keyExtractor={(item, index: number) => `${index}`}
      renderItem={({ item: slice, index, section }) => (
        <ReadingSlice
          key={slice.id}
          id={slice.id}
          description={slice.description}
          slices={slice.slices.filter(f => f.type !== 'Image')}
          status={slice.status}
          isLast={index === section.data.length - 1}
        />
      )}
      renderSectionHeader={({ section }) => (
        <Section
          key={section.id}
          image={section.image}
          id={section.id}
          title={section.title}
          subTitle={section.subTitle}
          progress={section.progress}
          toggle={toggle}
          isCollapsed={expandedSectionIds.includes(section.id)}
        />
      )}
    />
  )
}

export default Plan

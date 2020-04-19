import React from 'react'

import SectionList from '~common/ui/SectionList'
import {
  ComputedPlan,
  ComputedSection,
  ComputedReadingSlice,
} from '~common/types'
import ReadingSlice from './ReadingSlice'
import SectionHeader from './SectionHeader'

const PlanSectionList = ({
  id,
  title,
  description,
  progress,
  image,
  sections,
}: ComputedPlan) => {
  const [expandedSectionIds, setExpandedSectionIds] = React.useState<string[]>(
    []
  )

  React.useEffect(() => {
    const currentSectionId = sections.find(s =>
      s.data.find(d => d.status === 'Next')
    )?.id
    if (currentSectionId) {
      setExpandedSectionIds([currentSectionId])
    }
  }, [])

  const toggle = (sectionId: string) => {
    setExpandedSectionIds(s =>
      s.includes(sectionId) ? s.filter(i => i !== sectionId) : [...s, sectionId]
    )
  }

  if (!sections || !sections.length) {
    return null
  }

  return (
    <>
      <SectionList
        sections={sections.map(s => ({
          ...s,
          data: expandedSectionIds.includes(s.id) ? s.data : [],
        }))}
        keyExtractor={(section: ComputedSection) => section.id}
        renderItem={({
          item: slice,
          index,
          section,
        }: {
          item: ComputedReadingSlice
          index: number
          section: ComputedSection
        }) => (
          <ReadingSlice
            key={slice.id}
            planId={id}
            id={slice.id}
            title={slice.title}
            slices={slice.slices}
            status={slice.status}
            isSectionCompleted={section.progress === 1}
            isLast={index === section.data.length - 1}
          />
        )}
        renderSectionHeader={({ section }: { section: ComputedSection }) => (
          <SectionHeader
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
    </>
  )
}

export default PlanSectionList

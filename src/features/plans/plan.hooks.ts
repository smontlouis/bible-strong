import React from 'react'
import { ComputedSection, Section } from 'src/common/types'

const transformSections = (sections: Section[]): ComputedSection[] =>
  sections.map((s, i) => ({
    ...s,
    progress: i === 0 ? 1 : 0,
    readingSlices: undefined,
    data: s.readingSlices,
  }))

export const useTransformSections = (sections: Section[]) => {
  const { current: updatedSections } = React.useRef(transformSections(sections))
  return updatedSections
}

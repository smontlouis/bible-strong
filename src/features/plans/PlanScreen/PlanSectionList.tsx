import React from 'react'
import { LegendList, LegendListRef } from '@legendapp/list'

import { ComputedPlan, ComputedReadingSlice, ComputedSection } from '~common/types'
import ReadingSlice from './ReadingSlice'
import SectionHeader from './SectionHeader'
import { View } from 'react-native'

type SectionHeaderItem = {
  type: 'header'
  section: ComputedSection
}

type SectionDataItem = {
  type: 'item'
  slice: ComputedReadingSlice
  section: ComputedSection
  index: number
  isLast: boolean
}

type ListItem = SectionHeaderItem | SectionDataItem

const PlanSectionList = ({ id, sections }: ComputedPlan) => {
  const listRef = React.useRef<LegendListRef>(null)
  const [expandedSectionIds, setExpandedSectionIds] = React.useState<string[]>([])
  const pendingScrollToSection = React.useRef<string | null>(null)

  React.useEffect(() => {
    const currentSectionId = sections.find(s => s.data.find(d => d.status === 'Next'))?.id
    if (currentSectionId) {
      setExpandedSectionIds([currentSectionId])
    }
  }, [])

  const toggle = (sectionId: string) => {
    const isExpanding = !expandedSectionIds.includes(sectionId)

    if (isExpanding) {
      pendingScrollToSection.current = sectionId
    }

    setExpandedSectionIds(s =>
      s.includes(sectionId) ? s.filter(i => i !== sectionId) : [...s, sectionId]
    )
  }

  // Flatten sections into a single array for LegendList
  const { flattenedData, stickyIndices, headerIndexMap } = React.useMemo(() => {
    const data: ListItem[] = []
    const headerIndices: number[] = []
    const indexMap: Record<string, number> = {}

    for (const section of sections) {
      const isExpanded = expandedSectionIds.includes(section.id)

      // Track header index for scrolling
      indexMap[section.id] = data.length

      // Only make header sticky if section is expanded
      if (isExpanded) {
        headerIndices.push(data.length)
      }

      // Add section header
      data.push({ type: 'header', section })

      // Add section items only if expanded
      if (isExpanded) {
        section.data.forEach((slice, index) => {
          data.push({
            type: 'item',
            slice,
            section,
            index,
            isLast: index === section.data.length - 1,
          })
        })
      }
    }

    return { flattenedData: data, stickyIndices: headerIndices, headerIndexMap: indexMap }
  }, [sections, expandedSectionIds])

  // Scroll to expanded section after data updates
  React.useEffect(() => {
    if (pendingScrollToSection.current && listRef.current) {
      const sectionId = pendingScrollToSection.current
      const index = headerIndexMap[sectionId]

      if (index !== undefined) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index, animated: true })
        })
      }

      pendingScrollToSection.current = null
    }
  }, [flattenedData, headerIndexMap])

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <SectionHeader
          image={item.section.image}
          id={item.section.id}
          title={item.section.title}
          subTitle={item.section.subTitle}
          progress={item.section.progress}
          toggle={toggle}
          isCollapsed={expandedSectionIds.includes(item.section.id)}
        />
      )
    }

    return (
      <ReadingSlice
        planId={id}
        id={item.slice.id}
        title={item.slice.title}
        slices={item.slice.slices}
        status={item.slice.status}
        isSectionCompleted={item.section.progress === 1}
        isLast={item.isLast}
      />
    )
  }

  const getItemType = (item: ListItem) => item.type

  const keyExtractor = (item: ListItem) => {
    if (item.type === 'header') {
      return `header-${item.section.id}`
    }
    return `item-${item.slice.id}`
  }

  if (!sections || !sections.length) {
    return null
  }

  return (
    <LegendList
      ref={listRef}
      data={flattenedData}
      renderItem={renderItem}
      getItemType={getItemType}
      keyExtractor={keyExtractor}
      stickyIndices={stickyIndices}
    />
  )
}

export default PlanSectionList

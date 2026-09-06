import React, { useState } from 'react'
import SelectTabBar from '~common/SelectTabBar'
import Box from '~common/ui/Box'
import { Slide, Slides } from '~common/ui/Slider'
import ExploreScreen from './Explore/ExploreScreen'
import MyPlanListScreen from './MyPlanListScreen/MyPlanListScreen'
import { PAGE_CONTENT_MAX_WIDTH } from '~common/ui/PageContent'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { useTranslation } from 'react-i18next'
const PlanSelect = () => {
  const [index, setIndex] = useState(0)
  const { t } = useTranslation()
  return (
    <Container>
      <Header hasBackButton title={t('Plans & Méditations')} />
      <Box
        className="overflow-hidden border-continuous w-[100%] flex-[1] self-center"
        style={{ maxWidth: PAGE_CONTENT_MAX_WIDTH }}
      >
        <Box className="overflow-hidden border-continuous flex-[1]">
          <SelectTabBar index={index} onChange={setIndex} />
          <Slides index={index}>
            <Slide className="flex-[1]" key="plan">
              <MyPlanListScreen />
            </Slide>
            <Slide className="flex-[1]" key="explore">
              <ExploreScreen />
            </Slide>
          </Slides>
        </Box>
      </Box>
    </Container>
  )
}

export default PlanSelect

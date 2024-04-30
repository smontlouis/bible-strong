import React, { Component, useState } from 'react'

import PlanSelectTabNavigator from '~navigation/PlanSelectTabNavigator'

import SelectTabBar from '~common/SelectTabBar'
import Box from '~common/ui/Box'
import { Slide, Slides } from '~common/ui/Slider'
import ExploreScreen from './Explore/ExploreScreen'
import MyPlanListScreen from './MyPlanListScreen/MyPlanListScreen'
import { MAX_WIDTH } from '~helpers/useDimensions'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { useTranslation } from 'react-i18next'

const PlanSelect = () => {
  const [index, setIndex] = useState(0)
  const { t } = useTranslation()
  return (
    <Container>
      <Header hasBackButton title={t('Références')} />
      <Box maxWidth={MAX_WIDTH} width="100%" flex alignSelf="center">
        <Box flex>
          <SelectTabBar index={index} onChange={setIndex} />
          <Slides index={index}>
            <Slide key="plan" flex>
              <MyPlanListScreen />
            </Slide>
            <Slide key="explore" flex>
              <ExploreScreen />
            </Slide>
          </Slides>
        </Box>
      </Box>
    </Container>
  )
}

export default PlanSelect

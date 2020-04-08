import React from 'react'
import { useSelector } from 'react-redux'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import Link from '~common/Link'
import { RootState } from 'src/redux/modules/reducer'
import { Status } from 'src/common/types'

interface UserPlan {
  id: string
  status: Status
  readingSlices: UserReadingSlice[]
}

interface UserReadingSlice {
  id: string
  status: Status
}

const mockUserPlans: UserPlan[] = [
  {
    id: 'bible-project-plan',
    status: 'Idle',
    readingSlices: [
      {
        id: '0',
        status: 'Completed',
      },
      {
        id: '347',
        status: 'Next',
      },
    ],
  },
]

const PlanScreen = () => {
  // const myPlans = useSelector((state: RootState) => state.plan.myPlans)
  // const userPlans = useSelector((state: RootState) => mockUserPlans)
  console.log('ciyciy')
  return (
    <Container>
      <Header title="Mes Plans" hasBackButton />
    </Container>
  )
}

export default PlanScreen

import React from 'react'

import FlatList from '~common/ui/FlatList'
import { useComputedPlanItems, useDownloadPlans } from '../plan.hooks'
import { ComputedPlanItem } from 'src/common/types'
import Box from '~common/ui/Box'
import Spacer from '~common/ui/Spacer'
import PlanItem from './MyPlanItem'
import Loading from '~common/Loading'
import Empty from '~common/Empty'

const MyPlanListScreen = () => {
  const plans = useComputedPlanItems()
  const { isLoading } = useDownloadPlans()

  if (!plans || !plans.length) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message="Vous n'avez aucun plan..."
      />
    )
  }

  return (
    <FlatList
      ListHeaderComponent={
        <>
          {isLoading && (
            <Box height={50}>
              <Loading />
            </Box>
          )}
        </>
      }
      contentContainerStyle={{ paddingHorizontal: 20 }}
      bg="lightGrey"
      data={plans}
      renderItem={({ item }: { item: ComputedPlanItem }) => (
        <PlanItem {...item} />
      )}
      keyExtractor={(item: ComputedPlanItem) => item.id}
      ItemSeparatorComponent={Spacer}
    />
  )
}

MyPlanListScreen.navigationOptions = {
  tabBarLabel: 'Mes plans',
}

export default MyPlanListScreen

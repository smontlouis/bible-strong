import React from 'react'

import FlatList from '~common/ui/FlatList'
import { useComputedPlanItems, useDownloadPlans } from '../plan.hooks'
import { ComputedPlanItem } from 'src/common/types'
import Box from '~common/ui/Box'
import Spacer from '~common/ui/Spacer'
import PlanItem from './MyPlanItem'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import { useTranslation } from 'react-i18next'
import i18n from '~i18n'

const MyPlanListScreen = () => {
  const plans = useComputedPlanItems()
  const { isLoading } = useDownloadPlans()
  const { t } = useTranslation()

  if (!plans || !plans.length) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message={t("Vous n'avez aucun plan...")}
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
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
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

MyPlanListScreen.navigationOptions = () => ({
  tabBarLabel: i18n.t('Mes plans'),
})

export default MyPlanListScreen

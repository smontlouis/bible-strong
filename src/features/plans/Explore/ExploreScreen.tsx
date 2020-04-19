import React from 'react'
import { ScrollView } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { fetchPlans } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import ExplorePlanItem from './ExplorePlanItem'
import Loading from '~common/Loading'
import Empty from '~common/Empty'

const ExploreScreen = () => {
  const dispatch = useDispatch()
  const status = useSelector((state: RootState) => state.plan.onlineStatus)
  const plans = useSelector((state: RootState) => {
    const onlinePlans = [...state.plan.onlinePlans]
    onlinePlans.sort((a, b) =>
      a.featured === b.featured ? 0 : a.featured ? -1 : 1
    )

    return onlinePlans
  })

  React.useEffect(() => {
    if (status !== 'Resolved') {
      dispatch(fetchPlans())
    }
  }, [dispatch])

  if (status === 'Pending') {
    return <Loading />
  }

  if (status === 'Rejected') {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message="Impossible de charger les plans, vérifiez votre connexion..."
      />
    )
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        maxWidth: 600,
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '100%',
      }}
    >
      {plans.map(plan => (
        <ExplorePlanItem key={plan.id} {...plan} />
      ))}
    </ScrollView>
  )
}

ExploreScreen.navigationOptions = {
  tabBarLabel: 'Explorer',
}

export default ExploreScreen

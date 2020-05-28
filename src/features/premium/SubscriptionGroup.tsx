import React from 'react'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import {
  useSubscriptions,
  useInitInAppPurchases,
} from '~helpers/useInAppPurchases'
import SubscriptionPlan from './SubscriptionPlan'
import Loading from '~common/Loading'
import { requestSubscription } from 'react-native-iap'
import { mappingSku } from './PremiumScreen'

const SubscriptionGroup = () => {
  const [selectedSub, setSelectedSub] = React.useState(
    'com.smontlouis.biblestrong.oneyear'
  )
  const { status, subscriptions } = useSubscriptions()
  console.log(subscriptions)

  const submitSubscription = async (sku: string) => {
    try {
      await requestSubscription(sku)
    } catch (err) {
      console.warn(err.code, err.message)
    }
  }

  if (status === 'Rejected') {
    return null
  }

  if (status === 'Resolved' && subscriptions) {
    return (
      <Box bg="reverse" overflow="visible" pb={50}>
        <Box
          mt={-100}
          pt={50}
          px={10}
          row
          justifyContent="space-around"
          overflow="visible"
        >
          {subscriptions.map(sub => (
            <SubscriptionPlan
              key={sub.productId}
              productId={sub.productId}
              price={sub.localizedPrice}
              isSelected={selectedSub === sub.productId}
              variant={mappingSku[sub.productId]?.variant}
              discount={mappingSku[sub.productId]?.discount}
              onPress={() => setSelectedSub(sub.productId)}
            />
          ))}
        </Box>
        <Box p={20} pt={40}>
          <Button onPress={() => submitSubscription(selectedSub)}>
            Subscribe
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box height={100}>
      <Loading />
    </Box>
  )
}

export default SubscriptionGroup

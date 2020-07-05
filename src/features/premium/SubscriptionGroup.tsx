import React from 'react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import { useIapUser, buyProduct } from '~helpers/useInAppPurchases'
import SubscriptionPlan from './SubscriptionPlan'
import Loading from '~common/Loading'
import { mappingSku } from './PremiumScreen'
import useLogin from '~helpers/useLogin'
import { useDispatch } from 'react-redux'
import SnackBar from '~common/SnackBar'
import to from 'await-to-js'
import { useTranslation } from 'react-i18next'

const SubscriptionGroup = () => {
  const [selectedSub, setSelectedSub] = React.useState(
    'com.smontlouis.biblestrong.onemonth'
  )
  const { t } = useTranslation()
  const [processing, setProcessing] = React.useState(false)
  const { status, products } = useIapUser()
  const { user } = useLogin()
  const dispatch = useDispatch()

  const onSubscription = async () => {
    setProcessing(true)
    const [err] = await to(buyProduct(user.id, selectedSub, dispatch))
    if (err) {
      SnackBar.show(t('Une erreur est survenue.'))
    }
    setProcessing(false)
  }

  if (status === 'Rejected') {
    return (
      <Box px={40}>
        <Text textAlign="center" color="quart">
          {t("Impossible accéder aux offres d'abonnement.")}
        </Text>
      </Box>
    )
  }

  if (status === 'Resolved' && products) {
    return (
      <Box overflow="visible">
        <Box
          pt={10}
          px={10}
          row
          justifyContent="space-around"
          overflow="visible"
        >
          {products.map(sub => (
            <SubscriptionPlan
              key={sub.id}
              price={sub.price}
              isSelected={selectedSub === sub.sku}
              variant={mappingSku[sub.sku]?.variant}
              period={t('par mois')}
              onPress={() => setSelectedSub(sub.sku)}
            />
          ))}
        </Box>
        <Box p={20}>
          <Button isLoading={processing} onPress={onSubscription}>
            {t("S'abonner")}
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

import { subSkus } from '~helpers/useInAppPurchases'
import { subVariant } from './SubscriptionPlan'

export const [oneMonthSkuMin, oneMonthSku, oneMonthSkuMax] = subSkus

export const mappingSku = {
  [oneMonthSkuMin]: {
    variant: 'normal' as subVariant,
  },
  [oneMonthSku]: {
    variant: 'primary' as subVariant,
  },
  [oneMonthSkuMax]: {
    variant: 'normal' as subVariant,
  },
}

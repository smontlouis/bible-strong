import { useEffect, useState, useContext, useRef } from 'react'
import { Platform, EmitterSubscription } from 'react-native'
import { Status } from '~common/types'
import GlobalStateContext from '~helpers/globalContext'
import {
  initConnection,
  getSubscriptions,
  Subscription,
  InAppPurchase,
  SubscriptionPurchase,
  ProductPurchase,
  purchaseErrorListener,
  PurchaseError,
  finishTransaction,
  acknowledgePurchaseAndroid,
  finishTransactionIOS,
  purchaseUpdatedListener,
  Purchase,
  getPurchaseHistory,
  getAvailablePurchases,
} from 'react-native-iap'
import to from 'await-to-js'
import { useDispatch } from 'react-redux'
import { setSubscription } from '~redux/modules/user'

export const subSkus = [
  'com.smontlouis.biblestrong.onemonth',
  'com.smontlouis.biblestrong.threemonths',
  'com.smontlouis.biblestrong.oneyear',
]

export const useInitInAppPurchases = () => {
  const dispatch = useDispatch()
  const purchaseUpdateSubscription = useRef<EmitterSubscription>()
  const purchaseErrorSubscription = useRef<EmitterSubscription>()
  const { updateState } = useContext(GlobalStateContext)

  useEffect(() => {
    ;(async () => {
      const [err, canMakePayments] = await to(initConnection())

      if (!err && canMakePayments) {
        updateState('isIAPInitialized', canMakePayments)
        return
      }

      updateState('isIAPInitialized', false)
      console.log('error')
    })()
  }, [])

  useEffect(() => {
    purchaseUpdateSubscription.current = purchaseUpdatedListener(
      (purchase: InAppPurchase | SubscriptionPurchase | ProductPurchase) => {
        console.log('purchaseUpdatedListener', purchase)
        const receipt = purchase.transactionReceipt
        if (receipt) {
          if (Platform.OS === 'ios' && purchase.transactionId) {
            dispatch(setSubscription('premium'))
            finishTransactionIOS(purchase.transactionId)
          } else if (Platform.OS === 'android' && purchase.purchaseToken) {
            dispatch(setSubscription('premium'))
            acknowledgePurchaseAndroid(purchase.purchaseToken)
          }

          finishTransaction(purchase, false)
        }
      }
    )

    purchaseErrorSubscription.current = purchaseErrorListener(
      (error: PurchaseError) => {
        console.log('purchaseErrorListener', error)
      }
    )

    return () => {
      if (purchaseUpdateSubscription.current) {
        purchaseUpdateSubscription.current.remove()
        purchaseUpdateSubscription.current = undefined
      }
      if (purchaseErrorSubscription.current) {
        purchaseErrorSubscription.current.remove()
        purchaseErrorSubscription.current = undefined
      }
    }
  }, [dispatch])
}

export const useSubscriptions = () => {
  const {
    state: { isIAPInitialized },
  } = useContext(GlobalStateContext)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [status, setStatus] = useState<Status>('Idle')

  useEffect(() => {
    ;(async () => {
      if (!isIAPInitialized) return
      setStatus('Pending')
      const [err, subItems] = await to<Subscription[]>(
        getSubscriptions(subSkus)
      )

      if (!err && subItems) {
        setStatus('Resolved')
        setSubscriptions(subItems)
        return
      }

      setStatus('Rejected')
    })()
  }, [isIAPInitialized])

  return { status, subscriptions }
}

export const useRestorePurchases = () => {
  const {
    state: { isIAPInitialized },
  } = useContext(GlobalStateContext)
  const dispatch = useDispatch()

  useEffect(() => {
    ;(async () => {
      if (!isIAPInitialized) return
      const [err, p] = await to<Purchase[]>(getAvailablePurchases())

      if (!err && p) {
        p.forEach(purchase => {
          switch (purchase.productId) {
            case subSkus[0]:
            case subSkus[1]:
            case subSkus[2]: {
              dispatch(setSubscription('premium'))
              break
            }
            default: {
            }
          }
        })

        if (!p.length) {
          dispatch(setSubscription(null))
        }
      }
    })()
  }, [isIAPInitialized, dispatch])
}

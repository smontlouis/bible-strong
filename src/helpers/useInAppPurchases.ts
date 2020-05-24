import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { Status } from '~common/types'
import {
  initConnection,
  getSubscriptions,
  Subscription,
} from 'react-native-iap'
import to from 'await-to-js'

export const subSkus = [
  'com.smontlouis.biblestrong.onemonth',
  'com.smontlouis.biblestrong.threemonths',
  'com.smontlouis.biblestrong.oneyear',
]

export const useIAP = () => {
  const isInitIAP = useInitInAppPurchases()
  const { status, subscriptions } = useSubscriptions(isInitIAP)
  console.log(status, subscriptions)
}

export const useInitInAppPurchases = () => {
  const [isInitIAP, setInitIAP] = useState(false)
  useEffect(() => {
    ;(async () => {
      const [err, canMakePayments] = await to(initConnection())

      if (!err && canMakePayments) {
        setInitIAP(canMakePayments)
        return
      }

      setInitIAP(false)
      console.log('error')
    })()
  }, [])

  return isInitIAP
}

// export const usePurchaseListener = () => {
//   useEffect(() => {
//     ;(async () => {
//       // Set purchase listener
//       setPurchaseListener(({ responseCode, results, errorCode }) => {
//         // Purchase was successful
//         if (responseCode === IAPResponseCode.OK) {
//           results.forEach(purchase => {
//             if (!purchase.acknowledged) {
//               console.log(`Successfully purchased ${purchase.productId}`)
//               // Process transaction here and unlock content...

//               // Then when you're done
//               finishTransactionAsync(purchase, true)
//             }
//           })
//         }

//         // Else find out what went wrong
//         if (responseCode === IAPResponseCode.USER_CANCELED) {
//           console.log('User canceled the transaction')
//         } else if (responseCode === IAPResponseCode.DEFERRED) {
//           console.log(
//             'User does not have permissions to buy but requested parental approval (iOS only)'
//           )
//         } else {
//           console.warn(
//             `Something went wrong with the purchase. Received errorCode ${errorCode}`
//           )
//         }
//       })
//     })()
//   }, [])
// }

export const useSubscriptions = (isInitIAP: boolean) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [status, setStatus] = useState<Status>('Idle')

  useEffect(() => {
    ;(async () => {
      if (!isInitIAP) return
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
  }, [isInitIAP])

  return { status, subscriptions }
}

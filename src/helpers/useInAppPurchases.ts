import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { Status } from '~common/types'
import { Product, initConnection, getSubscriptions } from 'react-native-iap'
import to from 'await-to-js'

const itemSkus = Platform.select({
  ios: ['com.smontlouis.biblestrong.dev.onemonth'],
  android: ['com.example.coins100'],
})

export const useIAP = () => {
  const isInitIAP = useInitInAppPurchases()
  useProducts(isInitIAP)
}

export const useInitInAppPurchases = () => {
  const [isInitIAP, setInitIAP] = useState(false)
  useEffect(() => {
    ;(async () => {
      const [err] = await to(initConnection())
      console.log('IAP initialized')
      setInitIAP(true)
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

export const useProducts = (isInitIAP: boolean) => {
  const [products, setProducts] = useState<Product[]>([])
  const [status, setStatus] = useState<Status>('Idle')

  useEffect(() => {
    ;(async () => {
      if (!isInitIAP) return
      setStatus('Pending')
      const [err, productItems] = await to<Product[]>(
        getSubscriptions(itemSkus)
      )

      console.log(productItems)
      if (!err && productItems) {
        setProducts(productItems)
        setStatus('Resolved')
      } else {
        setStatus('Rejected')
      }
    })()
  }, [isInitIAP])

  return { status, products }
}

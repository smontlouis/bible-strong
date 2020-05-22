import { useEffect, useState } from 'react'
import {
  IAPResponseCode,
  connectAsync,
  getProductsAsync,
  setPurchaseListener,
  finishTransactionAsync,
  InAppPurchase,
  IAPItemDetails,
} from 'expo-in-app-purchases'
import { Platform } from 'react-native'
import { Status } from '~common/types'

export const productsDetails =
  Platform.OS === 'ios'
    ? [
        'com.smontlouis.biblestrong.onemonth',
        'com.smontlouis.biblestrong.threemonths',
        'com.smontlouis.biblestrong.oneyear',
      ]
    : [
        'dev.products.gas',
        'dev.products.premium',
        'dev.products.gold_monthly',
        'dev.products.gold_yearly',
      ]

export const useIAP = () => {
  const isInitIAP = useInitInAppPurchases()
  useProducts(isInitIAP)
}

export const useInitInAppPurchases = () => {
  const [isInitIAP, setInitIAP] = useState(false)
  useEffect(() => {
    ;(async () => {
      const history = await connectAsync()
      if (history.responseCode === IAPResponseCode.OK) {
        const { responseCode, results } = await getProductsAsync(
          productsDetails
        )
        if (responseCode === IAPResponseCode.OK) {
          console.log(results)
        }
      }
      setInitIAP(true)
    })()
  }, [])

  return isInitIAP
}

export const usePurchaseListener = () => {
  useEffect(() => {
    ;(async () => {
      // Set purchase listener
      setPurchaseListener(({ responseCode, results, errorCode }) => {
        // Purchase was successful
        if (responseCode === IAPResponseCode.OK) {
          results.forEach(purchase => {
            if (!purchase.acknowledged) {
              console.log(`Successfully purchased ${purchase.productId}`)
              // Process transaction here and unlock content...

              // Then when you're done
              finishTransactionAsync(purchase, true)
            }
          })
        }

        // Else find out what went wrong
        if (responseCode === IAPResponseCode.USER_CANCELED) {
          console.log('User canceled the transaction')
        } else if (responseCode === IAPResponseCode.DEFERRED) {
          console.log(
            'User does not have permissions to buy but requested parental approval (iOS only)'
          )
        } else {
          console.warn(
            `Something went wrong with the purchase. Received errorCode ${errorCode}`
          )
        }
      })
    })()
  }, [])
}

export const useProducts = (isInitIAP: boolean) => {
  const [products, setProducts] = useState<(InAppPurchase | IAPItemDetails)[]>(
    []
  )
  const [status, setStatus] = useState<Status>('Idle')

  useEffect(() => {
    ;(async () => {
      if (!isInitIAP) return
      setStatus('Pending')
      const { responseCode, results } = await getProductsAsync(productsDetails)
      console.log(responseCode, results)
      if (responseCode === IAPResponseCode.OK && results) {
        setProducts(results)
        setStatus('Resolved')
      } else {
        setStatus('Rejected')
      }
    })()
  }, [isInitIAP])

  return { status, products }
}

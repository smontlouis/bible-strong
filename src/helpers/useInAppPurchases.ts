import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import IAPHub from 'react-native-iaphub'
import to from 'await-to-js'
import { useDispatch } from 'react-redux'
import { setSubscription } from '~redux/modules/user'
import { useGlobalContext, GlobalContextProps } from '~helpers/globalContext'
import { Status } from '~common/types'
import useLogin from './useLogin'
import { Dispatch } from 'redux'
import Snackbar from '~common/SnackBar'
import { iaphub } from '../../config'

export const subSkus = [
  'com.smontlouis.biblestrong.onemonth.min',
  'com.smontlouis.biblestrong.onemonth',
  'com.smontlouis.biblestrong.onemonth.max',
]

export const useInitIAP = (store: GlobalContextProps) => {
  const {
    iap: [isIAPInitialized, setIsIAPInitialized],
  } = store

  useEffect(() => {
    ;(async () => {
      if (!isIAPInitialized) {
        try {
          await IAPHub.init({
            appId: iaphub.appId,
            apiKey: iaphub.apiKey,
            environment: 'production',
          })
          setIsIAPInitialized(true)
          console.log('IAP is initialized')
        } catch (e) {
          setIsIAPInitialized(false)
        }
      }
    })()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIAPInitialized])
}

export const useIapUser = () => {
  const { user } = useLogin()
  const [status, setStatus] = useState<Status>('Idle')
  const [products, setProducts] = useState<IAPHub.IapHubProductInformation[]>()
  const [currentProduct, setCurrentProducts] = useState<
    IAPHub.IapHubProductInformation[]
  >()

  useEffect(() => {
    ;(async () => {
      setStatus('Pending')
      try {
        await IAPHub.login(user.id)
        const { productsForSale, activeProducts } = await IAPHub.getUser()
        setCurrentProducts(activeProducts)
        productsForSale.sort((a, b) => {
          return a.priceAmount - b.priceAmount
        })
        setProducts(productsForSale)
        setStatus('Resolved')
      } catch (e) {
        console.log('Failed', e)
        setStatus('Rejected')
      }
    })()
  }, [])

  return { status, products, currentProduct }
}

export const buyProduct = async (
  userId: string,
  sku: string,
  dispatch: Dispatch<any>
) => {
  const [loginErr] = await to(IAPHub.login(userId))

  if (loginErr) {
    Snackbar.show(
      'Impossible de charger les produits, vérifiez votre connexion internet.'
    )
    return
  }

  console.log('Sending transaction...')
  const [error, transaction] = await to(IAPHub.buy(sku))
  console.log('Waiting for webhooks ...')

  if (!error) {
    if (transaction?.webhookStatus === 'failed') {
      Alert.alert(
        'Achat retardé',
        'Votre abonnement a été traité avec succès, mais nous avons besoin de plus de temps pour le valider, il devrait arriver bientôt ! Sinon, contactez-nous par mail.'
      )
    } else {
      Alert.alert('Achat réussi', 'Merci de nous faire confiance !')
      dispatch(setSubscription('premium'))
    }
  } else {
    const err = error as Error & { code: string }
    if (err.code === 'user_cancelled') return
    else if (err.code === 'product_already_owned') {
      Alert.alert('Erreur', 'Il semble que vous êtes déjà abonné.')
    } else if (err.code === 'receipt_validation_failed') {
      Alert.alert(
        "Nous n'avons pas réussi à valider votre transaction",
        'Donnez-nous un peu de temps, nous allons réessayer de valider votre transaction dès que possible !'
      )
    } else if (err.code === 'receipt_request_failed') {
      Alert.alert(
        'Nous avons des difficultés à valider votre transaction',
        'Veuillez nous contacter.'
      )
    } else {
      Alert.alert(
        "Erreur d'achat",
        'Une erreur est survenue, vérifiez votre connexion ou contactez-nous.'
      )
    }
  }
}

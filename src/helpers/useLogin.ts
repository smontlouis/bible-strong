import { useSelector } from 'react-redux'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { getAuth, deleteUser } from '@react-native-firebase/auth'
import FireAuth from '~helpers/FireAuth'
import { selectIsLogged, selectUserLoginInfo } from '~redux/selectors/user'

const useLogin = () => {
  const { t } = useTranslation()
  const isLogged = useSelector(selectIsLogged)
  const user = useSelector(selectUserLoginInfo)
  const logout = () => FireAuth.logout()
  const login = (email: string, password: string) => FireAuth.login(email, password)

  const promptDeleteAccount = () => {
    Alert.alert(t('Attention'), t('app.deleteAccountBody'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          Alert.alert(t('Attention'), t('app.deleteAccountBodyConfirm'), [
            { text: t('Non'), onPress: () => null, style: 'cancel' },
            {
              text: t('Delete'),
              onPress: async () => {
                const authUser = getAuth().currentUser
                if (authUser) {
                  try {
                    await deleteUser(authUser)
                    logout()
                  } catch (error: any) {
                    console.error('[Auth] Delete error:', error.code, error.message)
                    if (error.code === 'auth/requires-recent-login') {
                      Alert.alert(t('Attention'), t('app.deleteAccountRequiresRecentLogin'))
                    } else {
                      Alert.alert(t('Erreur'), error.message)
                    }
                  }
                }
              },
              style: 'destructive',
            },
          ])
        },
        style: 'destructive',
      },
    ])
  }

  return {
    isLogged,
    user,
    logout,
    login,
    promptDeleteAccount,
  }
}

export default useLogin

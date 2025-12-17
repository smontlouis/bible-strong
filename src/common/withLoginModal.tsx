import React from 'react'
import useLogin from '~helpers/useLogin'

import LoginModal from './LoginModal'

const withLogin = (Component: any) => (props: any) => {
  const { isLogged } = useLogin()

  return (
    <>
      <Component {...props} />
      <LoginModal isVisible={!isLogged} />
    </>
  )
}

export default withLogin

import React from 'react'
import useLogin from '~helpers/useLogin'

import LoginModal from './LoginModal'

const withLogin =
  <P extends object>(Component: React.ComponentType<P>) =>
  (props: P) => {
    const { isLogged } = useLogin()

    return (
      <>
        <Component {...props} />
        <LoginModal isVisible={!isLogged} />
      </>
    )
  }

export default withLogin

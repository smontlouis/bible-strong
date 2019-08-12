import React from 'react'
import { useSelector } from 'react-redux'

import LoginModal from './LoginModal'

const withLogin = (Component) => props => {
  const isLogged = useSelector(state => !!state.user.id)

  return (
    <>
      <Component {...props} />
      <LoginModal isVisible={!isLogged} />
    </>
  )
}

export default withLogin
